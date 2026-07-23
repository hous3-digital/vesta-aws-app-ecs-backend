import type { KycLevel } from "@src/shared/types/vesta-vc.types";
import type { KycStatusDecision } from "@src/modules/credential/api/public/inputs/credential-public-kyc-status.input";

export class CredentialPublicKycStatusCommand {
  public constructor(
    public readonly issuerId: string,
    public readonly cpf: string,
    public readonly status: KycStatusDecision,
    public readonly kycLevel: Exclude<KycLevel, "pending">,
    public readonly reason?: string,
  ) {}
}
