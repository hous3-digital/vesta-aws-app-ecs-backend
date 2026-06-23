import { Issuer as IssuerPrisma } from "@src/infra/database/@prisma/generated/client";
import { Issuer } from "@src/modules/issuer/domain/issuer.entity";

export class IssuerMapper {
  public static toDomain(prisma: IssuerPrisma): Issuer {
    return Issuer.restore({
      id: prisma.id,
      externalId: prisma.issuerId,
      name: prisma.name,
      status: prisma.status,
      publicKey: prisma.publicKey ?? null,
      privyEnabled: prisma.privyEnabled,
      createdAt: prisma.createdAt,
    });
  }
}
