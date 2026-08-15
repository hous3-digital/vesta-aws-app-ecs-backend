import { CommissionLedgerService } from "@src/modules/commission/commission-ledger.service";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";

describe("CommissionLedgerService", () => {
  it("scopes balances by issuer and separates financial states", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const groupBy = jest.fn().mockResolvedValue([
      { status: "PENDING_SECURITY", _sum: { amountMinor: 137 }, _count: { _all: 1 } },
      { status: "AVAILABLE", _sum: { amountMinor: 274 }, _count: { _all: 2 } },
      { status: "ALLOCATED", _sum: { amountMinor: 137 }, _count: { _all: 1 } },
    ]);
    const prisma = {
      commissionLedgerEntry: { updateMany, groupBy },
    } as unknown as PrismaService;
    const service = new CommissionLedgerService(prisma);

    const result = await service.getBalance("issuer_a");

    expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { issuerId: "issuer_a" } }));
    expect(result.pendingSecurity.amount).toBe(1.37);
    expect(result.available.amount).toBe(2.74);
    expect(result.allocated.amount).toBe(1.37);
    expect(result.amount).toBe(2.74);
  });

  it("returns an empty extract without recalculating attestations", async () => {
    const prisma = {
      commissionLedgerEntry: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const service = new CommissionLedgerService(prisma);
    await expect(service.listEntries("issuer_without_entries")).resolves.toEqual({ items: [], nextCursor: null });
  });
});
