import { PayoutProcessorService } from "@src/modules/commission/payout-processor.service";
import { SettlementRejectedError } from "@src/modules/commission/payout-settlement.gateway";

describe("PayoutProcessorService", () => {
  const candidate = {
    id: "payout-1",
    issuerId: "issuer-1",
    onChainPayoutId: "ab".repeat(32),
    destinationAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    settlementAmountAtomic: 13_700_000n,
  };
  const tx = {
    payoutAttempt: { update: jest.fn() },
    payoutRequest: { update: jest.fn() },
    commissionLedgerEntry: { updateMany: jest.fn() },
  };
  const prisma = {
    payoutRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    payoutAttempt: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    commissionLedgerEntry: { updateMany: jest.fn() },
    $transaction: jest.fn(async (value: unknown) => {
      if (typeof value === "function") return (value as (client: typeof tx) => unknown)(tx);
      return Promise.all(value as Promise<unknown>[]);
    }),
  };
  const gateway = { settle: jest.fn(), reconcile: jest.fn() };
  const service = new PayoutProcessorService(
    prisma as never,
    gateway as never,
    { PAYOUT_PROCESSOR_INTERVAL_MS: 10_000 } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.payoutRequest.findMany.mockResolvedValue([]);
    prisma.payoutRequest.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(candidate);
    prisma.payoutRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.payoutAttempt.count.mockResolvedValue(0);
    prisma.payoutAttempt.create.mockResolvedValue({ id: "attempt-1" });
    prisma.payoutAttempt.update.mockResolvedValue({});
    prisma.payoutAttempt.updateMany.mockResolvedValue({ count: 1 });
    prisma.payoutRequest.update.mockResolvedValue({});
    prisma.commissionLedgerEntry.updateMany.mockResolvedValue({ count: 1 });
    tx.payoutAttempt.update.mockResolvedValue({});
    tx.payoutRequest.update.mockResolvedValue({});
    tx.commissionLedgerEntry.updateMany.mockResolvedValue({ count: 1 });
  });

  it("marca créditos como liquidados somente após confirmação on-chain", async () => {
    gateway.settle.mockResolvedValue({ txHash: "tx-1", ledger: 123 });
    await service.processNext();

    expect(tx.payoutRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONFIRMED", stellarTxHash: "tx-1", activeIssuerId: null }),
    }));
    expect(tx.commissionLedgerEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SETTLED" }),
    }));
  });

  it("libera os créditos quando a rede rejeita definitivamente antes de pagar", async () => {
    gateway.settle.mockRejectedValue(new SettlementRejectedError("CONTRACT_REJECTED", "rejeitado"));
    await service.processNext();

    expect(prisma.payoutRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED", activeIssuerId: null }),
    }));
    expect(prisma.commissionLedgerEntry.updateMany).toHaveBeenCalledWith({
      where: { payoutRequestId: "payout-1", status: "ALLOCATED" },
      data: { status: "AVAILABLE", payoutRequestId: null },
    });
  });

  it("concilia pelo hash sem reenviar quando a confirmação inicial ficou incerta", async () => {
    const unknown = { ...candidate, status: "UNKNOWN", stellarTxHash: "tx-pending", updatedAt: new Date() };
    prisma.payoutRequest.findFirst
      .mockReset()
      .mockResolvedValueOnce(unknown)
      .mockResolvedValueOnce(null);
    gateway.reconcile.mockResolvedValue({ status: "CONFIRMED", ledger: 456 });

    await service.processNext();

    expect(gateway.reconcile).toHaveBeenCalledWith("tx-pending");
    expect(gateway.settle).not.toHaveBeenCalled();
    expect(prisma.payoutRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONFIRMED", stellarLedger: 456, activeIssuerId: null }),
    }));
    expect(prisma.commissionLedgerEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SETTLED" }),
    }));
  });
});
