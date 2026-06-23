import { Issuer } from "@src/modules/issuer/domain/issuer.entity";

export abstract class IIssuerRepository {
  /**
   * Procura o issuer pelo identificador externo (o `issuerId` usado no header
   * `X-Vesta-Issuer-ID` e como `issuer_id` na tabela Credential).
   */
  abstract findByExternalId(externalId: string): Promise<Issuer | null>;
}
