export class ProofPublicSubmitSignedCommand {
  public constructor(
    public readonly prepareSessionId: string,
    public readonly signedTxXdr: string,
    public readonly privyIdentityToken: string | null,
  ) {}
}
