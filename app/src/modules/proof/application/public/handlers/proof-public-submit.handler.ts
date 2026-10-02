import { Injectable, Logger } from "@nestjs/common";
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { ProofPublicSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-submit.command";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import { StellarService } from "@src/modules/stellar/stellar.service";
import { ZkService } from "@src/modules/zk/application/services/zk.service";
import { InvalidStateError, NotFoundError, ValidationError } from "@src/shared/errors";
import type { Groth16Proof, ZkProofResult } from "@src/shared/types/vesta-vc.types";
import { createHash } from "crypto";

@Injectable()
@CommandHandler(ProofPublicSubmitCommand)
export class ProofPublicSubmitHandler implements ICommandHandler<ProofPublicSubmitCommand> {
  private readonly logger = new Logger(ProofPublicSubmitHandler.name);

  public constructor(
    private readonly attestationRepository: IAttestationRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly issuerRepository: IIssuerRepository,
    private readonly zkService: ZkService,
    private readonly stellarService: StellarService,
  ) {}

  public async execute(command: ProofPublicSubmitCommand) {
    const credential = await this.credentialRepository.findByVcHash(command.vcHash);

    if (!credential) {
      throw new NotFoundError("CREDENTIAL_NOT_FOUND", "Credential not found", { vcHash: command.vcHash });
    }

    if (!credential.isApproved()) {
      throw new InvalidStateError("CREDENTIAL_NOT_APPROVED", "Only an active credential can be verified", {
        status: credential.status,
      });
    }

    if (credential.isExpired()) {
      throw new InvalidStateError("CREDENTIAL_EXPIRED", "Credential has expired");
    }

    const subject = credential.ensureDocument().credential_subject;

    const issuer = await this.issuerRepository.findByExternalId(credential.issuerId);
    if (!issuer) {
      this.logger.error(
        `Issuer ${credential.issuerId} da credencial ${credential.id.value} não encontrado; comissão não será atribuída`,
      );
    }

    const proof: Groth16Proof = {
      pi_a: command.proof.pi_a,
      pi_b: command.proof.pi_b,
      pi_c: command.proof.pi_c,
      protocol: command.proof.protocol ?? "groth16",
      curve: command.proof.curve ?? "bn128",
    };

    const { encodedProof, encodedPublicSignals } = this.encodeOrThrow(proof, command.publicSignals);

    await this.zkService.verifyProof(proof, command.publicSignals, {
      cpfHash: subject.cpf_hash,
      birthDateHash: subject.birth_date_hash,
      fullNameHash: subject.full_name_hash,
    });

    const proofHash = createHash("sha256").update(JSON.stringify(proof)).digest("hex");

    const stellarResult = await this.stellarService.submitZkProof({
      encodedProof,
      encodedVk: this.zkService.loadVerificationKey(),
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
      issuerId: issuer?.externalId ?? null,
      issuerDid: issuer?.did?.value ?? credential.issuerDid,
      userWalletAddress: null,
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

  /** The encoder parses every coordinate as a bigint; anything else is a malformed proof, not a server error. */
  private encodeOrThrow(
    proof: Groth16Proof,
    publicSignals: string[],
  ): Pick<ZkProofResult, "encodedProof" | "encodedPublicSignals"> {
    try {
      return this.zkService.encodeSubmittedProof(proof, publicSignals);
    } catch (cause) {
      throw new ValidationError("PROOF_MALFORMED", "Proof points and public signals must be decimal field elements", {
        cause: (cause as Error).message,
      });
    }
  }
}
