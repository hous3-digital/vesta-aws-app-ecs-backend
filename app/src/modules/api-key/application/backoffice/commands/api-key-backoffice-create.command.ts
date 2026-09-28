export class ApiKeyBackofficeCreateCommand {
  public constructor(
    public readonly name: string,
    /** Issuer of the backoffice session, never of the body. */
    public readonly issuerId: string,
  ) {}
}
