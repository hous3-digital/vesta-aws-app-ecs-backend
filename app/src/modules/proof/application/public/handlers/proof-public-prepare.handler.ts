import { BadRequestException, Injectable, Logger, UnprocessableEntityException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { ChallengeService } from "@src/modules/challenge/challenge.service";
import { Credential, CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { ProofPublicPrepareCommand } from "@src/modules/proof/application/public/commands/proof-public-prepare.command";
import { PrepareSessionService } from "@src/modules/proof/application/services/prepare-session.service";
import { StellarService } from "@src/modules/stellar/stellar.service";
import { VcService } from "@src/modules/vc/vc.service";
import { WalletService } from "@src/modules/wallet/wallet.service";
import { ZkService } from "@src/modules/zk/zk.service";
import type { KycLevel, VestaVC, ZkProofResult } from "@src/shared/types/vesta-vc.types";
import * as fs from "fs";
import * as path from "path";

export interface ProofPublicPrepareResult {
  prepareSessionId: string;
  unsignedTxXdr: string;
  requiresUserSignature: boolean;
  userWalletAddress: string | null;
  stellarNetworkPassphrase: string;
  zkProof: {
    protocol: string;
    curve: string;
    publicSignals: string[];
    proofHash: string;
    mock: boolean;
  };
}

@Injectable()
@CommandHandler(ProofPublicPrepareCommand)
export class ProofPublicPrepareHandler implements ICommandHandler<ProofPublicPrepareCommand, ProofPublicPrepareResult> {
  private readonly logger = new Logger(ProofPublicPrepareHandler.name);

  public constructor(
    private readonly credentialRepository: ICredentialRepository,
    private readonly issuerRepository: IIssuerRepository,
    private readonly walletService: WalletService,
    private readonly zkService: ZkService,
    private readonly stellarService: StellarService,
    private readonly vcService: VcService,
    private readonly challengeService: ChallengeService,
    private readonly prepareSessionService: PrepareSessionService,
  ) {}

  public async execute(command: ProofPublicPrepareCommand): Promise<ProofPublicPrepareResult> {
    const vc = command.vc as VestaVC;

    const challengeContext = await this.challengeService.consumeContext(command.challenge);
    if (!challengeContext) {
      throw new BadRequestException(
        "Challenge inválido, expirado ou já utilizado. Solicite um novo via GET /public/auth/challenge.",
      );
    }

    if (new Date(vc.expiration_date) < new Date()) {
      throw new UnprocessableEntityException("VC expirada — não é possível gerar prova");
    }

    const vcHash = this.vcService.hashVC(vc);
    const existingCredential = await this.credentialRepository.findByVcHash(vcHash);
    if (existingCredential && !existingCredential.vcDocument) {
      existingCredential.attachDocument(vc);
      await this.credentialRepository.updateOrThrow(existingCredential);
    }

    // Fonte da verdade para kycLevel é o banco (webhook do issuer atualiza lá,
    // mas a VC assinada no device fica cravada no nível de emissão). O `verify`
    // já lê do banco; alinhar aqui garante que o fluxo KYC assíncrono feche.
    const effectiveKycLevel: KycLevel = (existingCredential?.kycLevel ?? vc.credential_subject.kyc_level) as KycLevel;
    const kycLevelInt = this.vcService.kycLevelToInt(effectiveKycLevel);
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

    await this.validatePrivateInputsMatchVC(vc, command.privateInputs);

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

    const credential = existingCredential ?? (await this.upsertCredential(vc, vcHash));

    // Resolve issuer feature flag + lazy retroactive wallet creation
    const issuer = await this.issuerRepository.findByExternalId(credential.issuerId);
    const privyEnabled = !!issuer?.privyEnabled;

    if (
      privyEnabled &&
      (challengeContext.kind !== "proof" ||
        challengeContext.vcHash !== vcHash ||
        challengeContext.issuerId !== credential.issuerId)
    ) {
      throw new BadRequestException(
        "A prova para uma credencial Privy exige uma assertion Passkey verificada pelo servidor.",
      );
    }

    let userWalletAddress = credential.userWalletAddress;
    if (privyEnabled && !userWalletAddress) {
      this.logger.log(`Lazy retroativo: criando wallet Privy para credencial ${credential.id.value}`);
      try {
        const wallet = await this.walletService.precreateForCredential({
          subjectDid: credential.subjectDid,
          cpfDedupKey: credential.cpfDedupKey,
        });
        credential.attachWallet({
          userWalletAddress: wallet.stellarAddress,
          privyUserId: wallet.privyUserId,
        });
        await this.credentialRepository.updateOrThrow(credential);
        userWalletAddress = wallet.stellarAddress;
      } catch (err) {
        this.logger.error(`Falha em lazy retroativo: ${(err as Error).message}. Fallback para source=deployer.`);
      }
    }

    // Determina source da inner tx: wallet do usuário (privyEnabled + wallet existe) ou deployer
    const source = privyEnabled && userWalletAddress ? userWalletAddress : this.stellarService.getDeployerAddress();

    let encodedVk;
    try {
      encodedVk = this.zkService.loadVerificationKey();
    } catch {
      if (!this.zkService.isMockMode()) {
        throw new BadRequestException("verification_key.json não encontrado. Configure ZK_ARTIFACTS_DIR ou ative ZK_MOCK_MODE=true.");
      }
      encodedVk = this.buildMockVk();
    }

    const txBuild = await this.stellarService.buildUnsignedZkProofTx({
      source,
      encodedProof: zkResult.encodedProof,
      encodedVk,
      encodedPublicSignals: zkResult.encodedPublicSignals,
      vcHash,
      verifierId: command.verifierId,
    });

    const requiresUserSignature = privyEnabled && !!userWalletAddress && !txBuild.sourceAccountSignedByBackend;

    const prepareSessionId = await this.prepareSessionService.create({
      vcHash,
      proofHash: zkResult.proofHash,
      kycLevel: effectiveKycLevel,
      verifierId: command.verifierId,
      issuerId: issuer?.externalId ?? null,
      userWalletAddress,
      expectedSource: source,
      innerTxHash: txBuild.innerTxHash,
      sourceAccountSignedByBackend: txBuild.sourceAccountSignedByBackend,
      vc,
      mock: this.stellarService.isMockMode(),
      zkProof: {
        protocol: zkResult.proof.protocol,
        curve: zkResult.proof.curve,
        publicSignals: zkResult.publicSignals,
      },
    });

    return {
      prepareSessionId,
      unsignedTxXdr: txBuild.unsignedXdr,
      requiresUserSignature,
      userWalletAddress,
      stellarNetworkPassphrase: this.stellarService.getNetworkPassphrase(),
      zkProof: {
        protocol: zkResult.proof.protocol,
        curve: zkResult.proof.curve,
        publicSignals: zkResult.publicSignals,
        proofHash: zkResult.proofHash,
        mock: this.zkService.isMockMode(),
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
      const valid: boolean = await (snarkjs as unknown as { groth16: { verify: (vk: Record<string, unknown>, publicSignals: string[], proof: unknown) => Promise<boolean> } }).groth16.verify(vk, zkResult.publicSignals, zkResult.proof);
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

  private async upsertCredential(vc: VestaVC, vcHash: string): Promise<Credential> {
    const existing = await this.credentialRepository.findByVcHash(vcHash);
    if (existing) return existing;

    const issuerId = vc.issuer.id.split(":").pop() ?? vc.issuer.name;
    const credential = Credential.issue({
      vcHash,
      vcDocument: vc,
      cpfDedupKey: null,
      issuerDid: vc.issuer.id,
      issuerId,
      subjectDid: vc.credential_subject.id,
      kycLevel: vc.credential_subject.kyc_level,
      expiresAt: new Date(vc.expiration_date),
    });
    await this.credentialRepository.saveOrThrow(credential);
    return credential;
  }

  private async validatePrivateInputsMatchVC(
    vc: VestaVC,
    privateInputs: { cpf: string; birthDate: string; fullName: string },
  ): Promise<void> {
    const [cpfHash, birthDateHash, fullNameHash] = await Promise.all([
      this.vcService.hashCpf(privateInputs.cpf),
      this.vcService.hashBirthDate(privateInputs.birthDate),
      this.vcService.hashFullName(privateInputs.fullName),
    ]);

    const errors: string[] = [];
    if (cpfHash !== vc.credential_subject.cpf_hash) {
      errors.push("cpf não corresponde ao hash registrado na VC");
    }
    if (birthDateHash !== vc.credential_subject.birth_date_hash) {
      errors.push("birthDate não corresponde ao hash registrado na VC");
    }
    if (fullNameHash !== vc.credential_subject.full_name_hash) {
      this.logger.error(
        `fullName mismatch — hash calculado: ${fullNameHash}, hash na VC: ${vc.credential_subject.full_name_hash}`,
      );
      errors.push("fullName não corresponde ao hash registrado na VC (verifique espaços extras, acentos ou codificação)");
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Private inputs não correspondem à VC: ${errors.join("; ")}`);
    }

    // Used as a marker that CredentialStatus enum is referenced — avoids unused import
    void CredentialStatus;
  }

  private buildMockVk() {
    const zeroBuf64 = Buffer.alloc(64);
    const zeroBuf128 = Buffer.alloc(128);
    return { alpha: zeroBuf64, beta: zeroBuf128, gamma: zeroBuf128, delta: zeroBuf128, ic: [zeroBuf64, zeroBuf64] };
  }
}
