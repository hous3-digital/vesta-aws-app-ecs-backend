import { Credential } from "@src/modules/credential/domain/credential.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

export abstract class ICredentialRepository {
  abstract findByVcHash(vcHash: string): Promise<Credential | null>;
  /** Scoped by the issuer in the query: a credential of another issuer is indistinguishable from a missing one. */
  abstract findByVcHashForIssuerOrThrow(vcHash: string, issuerId: string): Promise<Credential>;
  abstract findByCpfDedupKey(cpfHash: string): Promise<Credential | null>;
  abstract findByIdOrThrow(id: Id): Promise<Credential>;
  abstract saveOrThrow(credential: Credential): Promise<Credential>;
  abstract updateOrThrow(credential: Credential): Promise<Credential>;
  abstract upsertByVcHash(credential: Credential): Promise<Credential>;
  abstract deleteById(id: Id): Promise<void>;
}
