import type { KycLevel } from "@src/shared/types/vesta-vc.types";

export class CredentialPublicIssueCommand {
  public constructor(
    public readonly issuerId: string,
    public readonly cpf: string,
    public readonly fullName: string,
    public readonly birthDate: string,
    public readonly kycLevel: KycLevel,
    public readonly kycMethod: string,
    public readonly nationality: string,
    public readonly expirationDays: number,
  ) {}
}
