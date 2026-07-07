import { Issuer } from "@src/modules/issuer/domain/issuer.entity";

export abstract class IIssuerRepository {
  /**
   * Procura o issuer pelo identificador externo usado internamente como
   * `issuer_id` na tabela Credential.
   */
  abstract findByExternalId(externalId: string): Promise<Issuer | null>;
}
