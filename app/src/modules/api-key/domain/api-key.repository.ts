import type { ApiKey } from "@src/modules/api-key/domain/api-key.entity";
import type { Id } from "@src/shared/value-objects/id.value-object";

/**
 * Write side of the api-key aggregate. Reads by hash return the row whatever
 * its state: usability (active, linked to an issuer, not expired) is the
 * entity's rule, not the query's.
 */
export abstract class IApiKeyRepository {
  /** The key whose SHA-256 hash is `keyHash`, or `null` when no row has it. */
  public abstract findByHash(keyHash: string): Promise<ApiKey | null>;
  /** Throws `NotFoundError` (`API_KEY_NOT_FOUND`) when the id has no row. */
  public abstract findByIdOrThrow(id: Id): Promise<ApiKey>;
  public abstract saveOrThrow(apiKey: ApiKey): Promise<ApiKey>;
  public abstract updateOrThrow(apiKey: ApiKey): Promise<ApiKey>;
}
