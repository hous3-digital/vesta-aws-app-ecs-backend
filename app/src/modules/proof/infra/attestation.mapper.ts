import { Attestation as AttestationPrisma } from "@src/infra/database/@prisma/generated/client";
import { Attestation } from "@src/modules/proof/domain/attestation.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export class AttestationMapper {
  public static toDomain(prisma: AttestationPrisma): Attestation {
    return Attestation.restore({
      id: Id.restore(prisma.id),
      vcHash: prisma.vcHash,
      proofHash: prisma.proofHash,
      verifierId: prisma.verifierId,
      kycLevel: prisma.kycLevel,
      sorobanTxHash: prisma.sorobanTxHash,
      sorobanLedger: prisma.sorobanLedger,
      onChainResult: prisma.onChainResult,
      createdAt: prisma.createdAt,
    });
  }

  public static toJSON(domain: Attestation): AttestationPrisma {
    return {
      id: domain.id.value,
      vcHash: domain.vcHash,
      proofHash: domain.proofHash,
      verifierId: domain.verifierId,
      kycLevel: domain.kycLevel,
      sorobanTxHash: domain.sorobanTxHash,
      sorobanLedger: domain.sorobanLedger,
      onChainResult: domain.onChainResult,
      createdAt: domain.createdAt,
    };
  }
}
