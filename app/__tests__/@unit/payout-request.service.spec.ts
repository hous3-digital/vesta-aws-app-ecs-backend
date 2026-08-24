import { BadRequestException } from "@nestjs/common";
import { PayoutRequestService } from "@src/modules/commission/payout-request.service";

describe("PayoutRequestService", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");
  const wallet = {
    id: "wallet-1",
    status: "ACTIVE",
    accountActivated: true,
    trustlineReady: true,
    controlVerifiedAt: new Date(),
    stellarAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    assetCode: "BRL",
    assetIssuer: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  };
  const created = {
    id: "payout-1",
    status: "REQUESTED",
    destinationAddress: wallet.stellarAddress,
    amountMinor: 274n,
    currency: "BRL",
    settlementAssetCode: "BRL",
    settlementAmountAtomic: 27_400_000n,
    stellarTxHash: null,
    stellarLedger: null,
    failureCode: null,
    requestedAt: now,
    submittedAt: null,
    confirmedAt: null,
  };
  const tx = {
    payoutRequest: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organizationWallet: { findUnique: jest.fn() },
    commissionLedgerEntry: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const prisma = {
    payoutRequest: { findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    payoutAttempt: { findMany: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const env = {
    NODE_ENV: "test",
    STELLAR_PAYOUT_ASSET_DECIMALS: 7,
    STELLAR_PAYOUT_CONTRACT_ID: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    STELLAR_PAYOUT_OPERATOR_SECRET: "S-test-only",
  };
  const walletService = { refreshOrganizationWalletReadiness: jest.fn() };
  const service = new PayoutRequestService(prisma as never, env as never, walletService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    walletService.refreshOrganizationWalletReadiness.mockResolvedValue({ payoutReady: true });
    prisma.payoutRequest.findUnique.mockResolvedValue(null);
    tx.payoutRequest.findUnique.mockResolvedValue(null);
    tx.organizationWallet.findUnique.mockResolvedValue(wallet);
    tx.commissionLedgerEntry.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 2 });
    tx.commissionLedgerEntry.findMany.mockResolvedValue([
      { id: "entry-1", amountMinor: 137 },
      { id: "entry-2", amountMinor: 137 },
    ]);
    tx.payoutRequest.create.mockImplementation(async ({ data }) => ({ ...created, ...data }));
  });

  it("reserva todo o saldo e converte centavos para unidades atômicas uma única vez", async () => {
    const result = await service.requestAllAvailable("issuer-1", "request-unique-1");

    expect(result.amountMinor).toBe("274");
    expect(result.settlementAmountAtomic).toBe("27400000");
    expect(tx.commissionLedgerEntry.updateMany).toHaveBeenLastCalledWith({
      where: { id: { in: ["entry-1", "entry-2"] }, status: "AVAILABLE", payoutRequestId: null },
      data: { status: "ALLOCATED", payoutRequestId: expect.stringMatching(/^payout_/) },
    });
  });

  it("retorna a mesma solicitação quando a chave idempotente é repetida", async () => {
    prisma.payoutRequest.findUnique.mockResolvedValue(created);
    const result = await service.requestAllAvailable("issuer-1", "request-unique-1");
    expect(result.id).toBe("payout-1");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("não reserva saldo quando a trustline não está pronta", async () => {
    tx.organizationWallet.findUnique.mockResolvedValue({ ...wallet, trustlineReady: false });
    await expect(service.requestAllAvailable("issuer-1", "request-unique-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
