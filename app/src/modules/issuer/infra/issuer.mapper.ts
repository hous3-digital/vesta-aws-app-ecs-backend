import { Issuer as IssuerPrisma } from "@src/infra/database/@prisma/generated/client";
import { Issuer, type IssuerRegistryStatus, type IssuerRole } from "@src/modules/issuer/domain/issuer.entity";
import { IssuerDid } from "@src/modules/issuer/domain/issuer-did.value-object";

export class IssuerMapper {
  public static toDomain(prisma: IssuerPrisma): Issuer {
    return Issuer.restore({
      id: prisma.id,
      externalId: prisma.issuerId,
      name: prisma.name,
      status: prisma.status,
      publicKey: prisma.publicKey ?? null,
      privyEnabled: prisma.privyEnabled,
      did: prisma.did ? IssuerDid.parse(prisma.did) : null,
      roles: prisma.roles as IssuerRole[],
      authorizedCredentialTypes: prisma.authorizedCredentialTypes,
      registryStatus: prisma.registryStatus as IssuerRegistryStatus,
      createdAt: prisma.createdAt,
    });
  }
}
