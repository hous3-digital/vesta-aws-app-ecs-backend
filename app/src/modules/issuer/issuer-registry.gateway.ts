export type RegistryIssuerRole = "TECHNICAL" | "COMMERCIAL";
export type RegistryParticipantStatus = "ACTIVE" | "SUSPENDED";

export interface RegistryCommissionTerm {
  role: RegistryIssuerRole;
  shareBps: number;
}

export interface RegistryParticipant {
  did: string;
  roles: RegistryIssuerRole[];
  payoutAddress: string;
  commissionTerms: RegistryCommissionTerm[];
  authorizedCredentialTypes: string[];
  status: RegistryParticipantStatus;
  registeredAt: number;
  updatedAt: number;
}

export interface RegisterOrUpdateParticipantParams {
  did: string;
  roles: RegistryIssuerRole[];
  payoutAddress: string;
  commissionTerms: RegistryCommissionTerm[];
  authorizedCredentialTypes: string[];
}

export interface RegistryMutationResult {
  operation: "REGISTERED" | "UPDATED";
  participant: RegistryParticipant;
  txHash: string;
  ledger: number;
}

export class IssuerRegistryUnavailableError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly txHash: string | null = null,
  ) {
    super(message);
    this.name = "IssuerRegistryUnavailableError";
  }
}

export abstract class IssuerRegistryGateway {
  public abstract getParticipant(did: string): Promise<RegistryParticipant | null>;
  public abstract registerOrUpdate(params: RegisterOrUpdateParticipantParams): Promise<RegistryMutationResult>;
}
