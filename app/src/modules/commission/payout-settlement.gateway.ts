export interface PayoutSettlementResult {
  txHash: string;
  ledger: number;
}

export type PayoutReconciliationResult =
  | { status: "CONFIRMED"; ledger: number }
  | { status: "FAILED" }
  | { status: "PENDING" };

export interface SettlePayoutParams {
  payoutId: string;
  beneficiaryId: string;
  destinationAddress: string;
  amountAtomic: bigint;
}

export class SettlementUnknownError extends Error {
  public constructor(
    message: string,
    public readonly txHash: string | null = null,
  ) {
    super(message);
    this.name = "SettlementUnknownError";
  }
}

export class SettlementRejectedError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SettlementRejectedError";
  }
}

export abstract class PayoutSettlementGateway {
  public abstract settle(params: SettlePayoutParams): Promise<PayoutSettlementResult>;
  public abstract reconcile(txHash: string): Promise<PayoutReconciliationResult>;
}
