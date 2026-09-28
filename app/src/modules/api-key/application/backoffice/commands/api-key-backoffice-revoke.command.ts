export class ApiKeyBackofficeRevokeCommand {
  public constructor(
    public readonly apiKeyId: string,
    /** Issuer of the backoffice session, never of the body. */
    public readonly issuerId: string,
  ) {}
}
