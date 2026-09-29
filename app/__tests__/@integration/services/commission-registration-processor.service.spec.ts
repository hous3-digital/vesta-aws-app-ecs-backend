import { CommissionRegistrationProcessorService } from "@src/modules/commission/commission-registration-processor.service";
import { CommissionRegistrationRejectedError } from "@src/modules/commission/commission-registration.gateway";

describe("CommissionRegistrationProcessorService", () => {
  const candidate = {
    id: "commission-1",
    issuerId: "issuer-1",
    entryType: "ACCRUAL",
    amountMinor: 137,
    onChainCreditId: null,
    onChainBeneficiaryId: null,
    onChainAmountAtomic: null,
  };
  const prisma = {
    commissionLedgerEntry: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const gateway = { register: jest.fn(), reconcile: jest.fn() };
  const env = {
    COMMISSION_REGISTRATION_PROCESSOR_INTERVAL_MS: 10_000,
    STELLAR_PAYOUT_ASSET_DECIMALS: 7,
  };
  const service = new CommissionRegistrationProcessorService(prisma as never, gateway as never, env as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.commissionLedgerEntry.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(candidate);
    prisma.commissionLedgerEntry.updateMany.mockResolvedValue({ count: 1 });
    prisma.commissionLedgerEntry.update.mockResolvedValue({});
  });

  it("registra a comissão em unidades atômicas e confirma a evidência Stellar", async () => {
    gateway.register.mockResolvedValue({ txHash: "tx-credit", ledger: 321, recovered: false });

    await service.processNext();

    expect(gateway.register).toHaveBeenCalledWith({
      creditId: expect.stringMatching(/^[a-f0-9]{64}$/),
      beneficiaryId: expect.stringMatching(/^[a-f0-9]{64}$/),
      amountAtomic: 13_700_000n,
    });
    expect(prisma.commissionLedgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onChainStatus: "CONFIRMED",
          onChainTxHash: "tx-credit",
          onChainLedger: 321,
        }),
      }),
    );
  });

  it("recupera com idempotência quando o crédito já existe no contrato", async () => {
    gateway.register.mockResolvedValue({ txHash: null, ledger: null, recovered: true });

    await service.processNext();

    expect(prisma.commissionLedgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ onChainStatus: "CONFIRMED" }) }),
    );
  });

  it("manda para revisão quando o mesmo ID on-chain possui dados divergentes", async () => {
    gateway.register.mockRejectedValue(new CommissionRegistrationRejectedError("CREDIT_MISMATCH", "dados divergentes"));

    await service.processNext();

    expect(prisma.commissionLedgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onChainStatus: "REQUIRES_REVIEW", onChainFailureCode: "CREDIT_MISMATCH" }),
      }),
    );
  });
});
