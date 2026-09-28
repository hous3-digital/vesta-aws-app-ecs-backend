export class ApiKeyAdminCreateCommand {
  public constructor(
    public readonly name: string,
    public readonly issuerId: string,
  ) {}
}
