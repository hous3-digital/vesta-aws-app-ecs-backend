import type { Prisma } from "@src/infra/database/@prisma/generated/client";
import { Credential as CredentialPrisma } from "@src/infra/database/@prisma/generated/client";
import { Credential, CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import { Id } from "@src/shared/value-objects/id.value-object";
import type { KycLevel } from "@src/shared/types/vesta-vc.types";

export class CredentialMapper {
  public static toDomain(prisma: CredentialPrisma): Credential {
    return Credential.restore({
      id: Id.restore(prisma.id),
      vcHash: prisma.vcHash,
      cpfDedupKey: prisma.cpfDedupKey ?? null,
      issuerDid: prisma.issuerDid,
      issuerId: prisma.issuerId,
      subjectDid: prisma.subjectDid,
      kycLevel: prisma.kycLevel,
      status: prisma.status as unknown as CredentialStatus,
      sorobanTxHash: prisma.sorobanTxHash,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      expiresAt: prisma.expiresAt ?? new Date(0),
    });
  }

  public static toCreateInput(domain: Credential): Prisma.CredentialCreateInput {
    return {
      id: domain.id.value,
      vcHash: domain.vcHash,
      cpfDedupKey: domain.cpfDedupKey,
      issuerDid: domain.issuerDid,
      issuerId: domain.issuerId,
      subjectDid: domain.subjectDid,
      kycLevel: domain.kycLevel as KycLevel,
      status: domain.status as unknown as Prisma.CredentialCreateInput["status"],
      sorobanTxHash: domain.sorobanTxHash,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      expiresAt: domain.expiresAt,
    };
  }

  public static toUpdateInput(domain: Credential): Prisma.CredentialUpdateInput {
    return {
      status: domain.status as unknown as Prisma.CredentialUpdateInput["status"],
      sorobanTxHash: domain.sorobanTxHash,
      updatedAt: domain.updatedAt,
      expiresAt: domain.expiresAt,
    };
  }
}
