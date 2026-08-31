export interface RegisterCommissionParams {
  creditId: string;
  beneficiaryId: string;
  amountAtomic: bigint;
}

export interface CommissionRegistrationResult {
  txHash: string | null;
  ledger: number | null;
  recovered: boolean;
}

export type CommissionRegistrationReconciliationResult =
  | { status: "CONFIRMED"; ledger: number }
  | { status: "FAILED" }
  | { status: "PENDING" };

export class CommissionRegistrationUnknownError extends Error {
  public constructor(
    message: string,
    public readonly txHash: string | null = null,
  ) {
    super(message);
    this.name = "CommissionRegistrationUnknownError";
  }
}

export class CommissionRegistrationRejectedError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommissionRegistrationRejectedError";
  }
}

export abstract class CommissionRegistrationGateway {
  public abstract register(params: RegisterCommissionParams): Promise<CommissionRegistrationResult>;
  public abstract reconcile(txHash: string): Promise<CommissionRegistrationReconciliationResult>;
}
