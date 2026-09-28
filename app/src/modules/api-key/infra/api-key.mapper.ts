import type { ApiKey as ApiKeyPrisma, Prisma } from "@src/infra/database/@prisma/generated/client";
import { ApiKey } from "@src/modules/api-key/domain/api-key.entity";
import { InvalidStateError } from "@src/shared/errors";
import { Id } from "@src/shared/value-objects/id.value-object";

export class ApiKeyMapper {
  /**
   * A row without hash or prefix cannot exist after the add_api_key_hash
   * backfill; refusing it here keeps a half-migrated row from authenticating
   * or being displayed with an empty prefix.
   */
  public static toDomain(prisma: ApiKeyPrisma): ApiKey {
    if (prisma.keyHash === null || prisma.keyPrefix === null) {
      throw new InvalidStateError("API_KEY_NOT_HASHED", "API key row has no hash or prefix", { apiKeyId: prisma.id });
    }

    return ApiKey.restore({
      id: Id.restore(prisma.id),
      issuerId: prisma.issuerId,
      keyHash: prisma.keyHash,
      keyPrefix: prisma.keyPrefix,
      name: prisma.name,
      active: prisma.active,
      createdAt: prisma.createdAt,
      revokedAt: prisma.revokedAt,
      expiresAt: prisma.expiresAt,
    });
  }

  /** Never writes `key`: the clear column belongs to rows created before the hash migration. */
  public static toCreateInput(domain: ApiKey): Prisma.ApiKeyCreateInput {
    return {
      id: domain.id.value,
      issuerId: domain.issuerId,
      keyHash: domain.keyHash,
      keyPrefix: domain.keyPrefix,
      name: domain.name,
      active: domain.active,
      createdAt: domain.createdAt,
      revokedAt: domain.revokedAt,
      expiresAt: domain.expiresAt,
    };
  }

  public static toUpdateInput(domain: ApiKey): Prisma.ApiKeyUpdateInput {
    return {
      active: domain.active,
      revokedAt: domain.revokedAt,
      expiresAt: domain.expiresAt,
    };
  }
}
