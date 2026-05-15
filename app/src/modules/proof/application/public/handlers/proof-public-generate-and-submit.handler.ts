import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { ProofPublicGenerateAndSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-generate-and-submit.command";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { Credential, CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import { StellarService } from "@src/modules/stellar/stellar.service";
import { VcService } from "@src/modules/vc/vc.service";
import { ZkService } from "@src/modules/zk/zk.service";
import type { VestaVC, ZkProofResult } from "@src/shared/types/vesta-vc.types";
import * as fs from "fs";
import * as path from "path";

@Injectable()
@CommandHandler(ProofPublicGenerateAndSubmitCommand)
export class ProofPublicGenerateAndSubmitHandler implements ICommandHandler<ProofPublicGenerateAndSubmitCommand> {
  private readonly logger = new Logger(ProofPublicGenerateAndSubmitHandler.name);

  public constructor(
    private readonly attestationRepository: IAttestationRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly zkService: ZkService,
    private readonly stellarService: StellarService,
    private readonly vcService: VcService,
    private readonly challengeService: ChallengeService,
  ) {}

  public async execute(command: ProofPublicGenerateAndSubmitCommand) {
    const vc = command.vc as VestaVC;

    if (command.challenge) {
      const valid = this.challengeService.consume(command.challenge);
      if (!valid) {
        throw new BadRequestException(
          "Challenge WebAuthn inválido, expirado ou já utilizado. Solicite um novo via GET /public/auth/challenge.",
        );
      }
      this.logger.log("Challenge WebAuthn verificado e consumido");
    } else {
      this.logger.warn("Requisição sem challenge WebAuthn — vulnerável a replay attack.");
    }

    if (new Date(vc.expiration_date) < new Date()) {
      throw new UnprocessableEntityException("VC expirada — não é possível gerar prova");
    }

    const kycLevelInt = this.vcService.kycLevelToInt(vc.credential_subject.kyc_level);

    if (kycLevelInt < command.minKycLevel) {
      throw new BadRequestException(
        `KYC level insuficiente: VC tem nivel ${kycLevelInt}, mínimo exigido é ${command.minKycLevel}`,
      );
    }

    if (this.zkService.isMockMode() && !this.stellarService.isMockMode()) {
      throw new BadRequestException(
        "Configuração inválida: ZK_MOCK_MODE=true com contrato Soroban real. " +
          "Provas mock não são pontos válidos na curva BN254 — o contrato irá falhar. " +
          "Configure ZK_MOCK_MODE=false e forneça os artefatos compilados.",
      );
    }

    this.logger.log(`Gerando prova ZK — verifier: ${command.verifierId}`);
    const zkResult = await this.zkService.generateProof({
      cpfHash: vc.credential_subject.cpf_hash,
      birthDateHash: vc.credential_subject.birth_date_hash,
      fullNameHash: vc.credential_subject.full_name_hash,
      kycLevel: kycLevelInt,
      minKycLevel: command.minKycLevel,
      cpf: command.privateInputs.cpf,
      birthDate: command.privateInputs.birthDate,
      fullName: command.privateInputs.fullName,
    });

    if (!this.zkService.isMockMode()) {
      await this.verifyProofLocally(zkResult);
    }

    const vcHash = this.vcService.hashVC(vc);
    await this.upsertCredential(vc, vcHash);

    let encodedVk;
    try {
      encodedVk = this.zkService.loadVerificationKey();
    } catch {
      if (!this.zkService.isMockMode()) {
        throw new BadRequestException("verification_key.json não encontrado. Configure ZK_ARTIFACTS_DIR ou ative ZK_MOCK_MODE=true.");
      }
      encodedVk = this.buildMockVk();
    }

    this.logger.log(`Submetendo ao Soroban — mock: ${this.stellarService.isMockMode()}`);
    const stellarResult = await this.stellarService.submitZkProof({
      encodedProof: zkResult.encodedProof,
      encodedVk,
      encodedPublicSignals: zkResult.encodedPublicSignals,
      vcHash,
      verifierId: command.verifierId,
    });

    const attestation = Attestation.create({
      vcHash,
      proofHash: zkResult.proofHash,
      verifierId: command.verifierId,
      kycLevel: vc.credential_subject.kyc_level,
      sorobanTxHash: stellarResult.txHash,
      sorobanLedger: stellarResult.ledger,
      onChainResult: stellarResult.onChainResult,
    });

    await this.attestationRepository.saveOrThrow(attestation);

    return {
      verified: stellarResult.onChainResult,
      zkProof: {
        protocol: zkResult.proof.protocol,
        curve: zkResult.proof.curve,
        publicSignals: zkResult.publicSignals,
        proofHash: zkResult.proofHash,
        mock: this.zkService.isMockMode(),
      },
      stellar: {
        txHash: stellarResult.txHash,
        ledger: stellarResult.ledger,
        contractId: this.stellarService.getContractId(),
        network: "stellar:soroban:testnet",
        mock: stellarResult.mock,
      },
      attestation: {
        id: attestation.id.value,
        vcHash,
        verifierId: command.verifierId,
        kycLevel: vc.credential_subject.kyc_level,
        createdAt: attestation.createdAt.toISOString(),
      },
    };
  }

  private async verifyProofLocally(zkResult: ZkProofResult): Promise<void> {
    try {
      const vkPath = path.join(this.zkService.getArtifactsDir(), "verification_key.json");
      if (!fs.existsSync(vkPath)) {
        this.logger.warn("verification_key.json não encontrado — pulando verificação local");
        return;
      }
      const vk = JSON.parse(fs.readFileSync(vkPath, "utf-8")) as Record<string, unknown>;
      const snarkjs = await import("snarkjs");
      const valid: boolean = await (snarkjs as any).groth16.verify(vk, zkResult.publicSignals, zkResult.proof);
      if (!valid) {
        throw new UnprocessableEntityException(
          "Prova ZK inválida (verificação local falhou). Artefatos inconsistentes — rebuilde o circuito.",
        );
      }
      this.logger.log("Prova ZK verificada localmente (snarkjs) ✓");
    } catch (err) {
      if (err instanceof UnprocessableEntityException) throw err;
      this.logger.warn(`Verificação local da prova ZK falhou com erro inesperado: ${(err as Error).message}`);
    }
  }

  private async upsertCredential(vc: VestaVC, vcHash: string): Promise<void> {
    const existing = await this.credentialRepository.findByVcHash(vcHash);
    if (!existing) {
      const issuerId = vc.issuer.id.split(":").pop() ?? vc.issuer.name;
      const credential = Credential.issue({
        vcHash,
        issuerDid: vc.issuer.id,
        issuerId,
        subjectDid: vc.credential_subject.id,
        kycLevel: vc.credential_subject.kyc_level,
        expiresAt: new Date(vc.expiration_date),
      });
      await this.credentialRepository.saveOrThrow(credential);
    }
  }

  private buildMockVk() {
    const zeroBuf64 = Buffer.alloc(64);
    const zeroBuf128 = Buffer.alloc(128);
    return { alpha: zeroBuf64, beta: zeroBuf128, gamma: zeroBuf128, delta: zeroBuf128, ic: [zeroBuf64, zeroBuf64] };
  }
}
