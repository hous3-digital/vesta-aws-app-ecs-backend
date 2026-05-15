import { BadRequestException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { ProofPublicSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-submit.command";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { StellarService } from "@src/modules/stellar/stellar.service";
import { ZkService } from "@src/modules/zk/zk.service";
import { encodeProof, encodeFr } from "@src/modules/zk/zk-encoder";
import type { Groth16Proof } from "@src/shared/types/vesta-vc.types";
import { createHash } from "crypto";

@Injectable()
@CommandHandler(ProofPublicSubmitCommand)
export class ProofPublicSubmitHandler implements ICommandHandler<ProofPublicSubmitCommand> {
  private readonly logger = new Logger(ProofPublicSubmitHandler.name);

  public constructor(
    private readonly attestationRepository: IAttestationRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly zkService: ZkService,
    private readonly stellarService: StellarService,
  ) {}

  public async execute(command: ProofPublicSubmitCommand) {
    const credential = await this.credentialRepository.findByVcHash(command.vcHash);

    if (!credential) {
      throw new NotFoundException(`Credencial não encontrada: ${command.vcHash}`);
    }

    if (!credential.isApproved()) {
      throw new UnprocessableEntityException(`Credencial com status '${credential.status}' — apenas 'approved' aceita`);
    }

    if (credential.isExpired()) {
      throw new UnprocessableEntityException("Credencial expirada");
    }

    const proof: Groth16Proof = {
      pi_a: command.proof.pi_a,
      pi_b: command.proof.pi_b,
      pi_c: command.proof.pi_c,
      protocol: command.proof.protocol ?? "groth16",
      curve: command.proof.curve ?? "bn128",
    };

    const encodedProof = encodeProof(proof);
    const encodedPublicSignals = command.publicSignals.map((s) => encodeFr(s));

    let encodedVk;
    try {
      encodedVk = this.zkService.loadVerificationKey();
    } catch {
      if (!this.zkService.isMockMode()) {
        throw new BadRequestException("verification_key.json não encontrado.");
      }
      const zeroBuf64 = Buffer.alloc(64);
      const zeroBuf128 = Buffer.alloc(128);
      encodedVk = { alpha: zeroBuf64, beta: zeroBuf128, gamma: zeroBuf128, delta: zeroBuf128, ic: [zeroBuf64, zeroBuf64] };
    }

    const proofHash = createHash("sha256").update(JSON.stringify(proof)).digest("hex");

    const stellarResult = await this.stellarService.submitZkProof({
      encodedProof,
      encodedVk,
      encodedPublicSignals,
      vcHash: command.vcHash,
      verifierId: command.verifierId,
    });

    const attestation = Attestation.create({
      vcHash: command.vcHash,
      proofHash,
      verifierId: command.verifierId,
      kycLevel: credential.kycLevel,
      sorobanTxHash: stellarResult.txHash,
      sorobanLedger: stellarResult.ledger,
      onChainResult: stellarResult.onChainResult,
    });

    await this.attestationRepository.saveOrThrow(attestation);

    return {
      verified: stellarResult.onChainResult,
      stellar: {
        txHash: stellarResult.txHash,
        ledger: stellarResult.ledger,
        contractId: this.stellarService.getContractId(),
        mock: stellarResult.mock,
      },
      attestation: {
        id: attestation.id.value,
        vcHash: command.vcHash,
        kycLevel: credential.kycLevel,
        createdAt: attestation.createdAt.toISOString(),
      },
    };
  }
}
