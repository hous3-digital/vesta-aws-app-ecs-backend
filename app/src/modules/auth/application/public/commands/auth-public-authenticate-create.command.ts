export class AuthPublicAuthenticateCreateCommand {
  public constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}
