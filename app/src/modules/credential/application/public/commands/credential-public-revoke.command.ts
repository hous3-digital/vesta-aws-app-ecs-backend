export class CredentialPublicRevokeCommand {
  public constructor(
    public readonly vcHash: string,
    public readonly reason?: string,
  ) {}
}
