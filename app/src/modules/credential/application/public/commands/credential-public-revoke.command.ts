export class CredentialPublicRevokeCommand {
  public constructor(
    public readonly issuerId: string,
    public readonly vcHash: string,
    public readonly reason?: string,
  ) {}
}
