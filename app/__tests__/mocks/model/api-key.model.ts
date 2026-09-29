import { ApiKeySecret } from "@src/modules/api-key/domain/api-key-secret.value-object";
import { ApiKey, type ApiKeyProps } from "@src/modules/api-key/domain/api-key.entity";
import { Id } from "@src/shared/value-objects/id.value-object";
import { FIXTURE_API_KEY, FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";

/** The fixture issuer's active key, restored as if read from the database: hash and prefix of FIXTURE_API_KEY. */
export function apiKeyModel(overrides: Partial<ApiKeyProps> = {}): ApiKey {
  const secret = ApiKeySecret.fromRaw(FIXTURE_API_KEY);
  return ApiKey.restore({
    id: Id.restore("ak_local_dev"),
    issuerId: FIXTURE_ISSUER_EXTERNAL_ID,
    keyHash: secret.hash,
    keyPrefix: secret.prefix,
    name: "Local SDK",
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  });
}
