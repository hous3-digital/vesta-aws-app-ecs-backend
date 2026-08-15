import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { Id } from "@src/shared/value-objects/id.value-object";

const money = (minor: number) => Math.round(minor) / 100;

@Injectable()
export class CommissionLedgerService {
  public constructor(private readonly prisma: PrismaService) {}

  public async getBalance(issuerId: string) {
    await this.releaseSecurityPeriod({ issuerId, cutoffAt: new Date() });
    const groups = await this.prisma.commissionLedgerEntry.groupBy({
      by: ["status"],
      where: { issuerId },
      _sum: { amountMinor: true },
      _count: { _all: true },
    });
    const byStatus = new Map(groups.map((group) => [group.status, group]));
    const value = (status: "PENDING_SECURITY" | "AVAILABLE" | "ALLOCATED" | "SETTLED") =>
      byStatus.get(status)?._sum.amountMinor ?? 0;
    const count = (status: "PENDING_SECURITY" | "AVAILABLE" | "ALLOCATED" | "SETTLED") =>
      byStatus.get(status)?._count._all ?? 0;

    return {
      currency: "BRL" as const,
      amount: money(value("AVAILABLE")),
      verificationsCount: count("PENDING_SECURITY") + count("AVAILABLE") + count("ALLOCATED") + count("SETTLED"),
      pendingSecurity: { amount: money(value("PENDING_SECURITY")), entriesCount: count("PENDING_SECURITY") },
      available: { amount: money(value("AVAILABLE")), entriesCount: count("AVAILABLE") },
      allocated: { amount: money(value("ALLOCATED")), entriesCount: count("ALLOCATED") },
      settled: { amount: money(value("SETTLED")), entriesCount: count("SETTLED") },
    };
  }

  public async listEntries(issuerId: string, limit = 50, cursor?: string) {
    await this.releaseSecurityPeriod({ issuerId, cutoffAt: new Date() });
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.commissionLedgerEntry.findMany({
      where: { issuerId },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasNext = rows.length > take;
    const items = rows.slice(0, take).map((row) => ({
      id: row.id,
      origin: row.source,
      occurredAt: row.occurredAt.toISOString(),
      availableAt: row.availableAt.toISOString(),
      amount: money(row.amountMinor),
      currency: row.currency,
      type: row.entryType,
      status: row.status,
      attestationId: row.attestationId,
      payoutCycleId: row.payoutCycleId,
    }));
    return { items, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
  }

  public async periodTotals(issuerId: string, from: Date, to: Date) {
    const rows = await this.prisma.commissionLedgerEntry.findMany({
      where: { issuerId, occurredAt: { gte: from, lte: to }, status: { not: "REVERSED" } },
      select: { amountMinor: true, occurredAt: true, entryType: true },
    });
    return {
      amountMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0),
      count: rows.filter((row) => row.entryType === "ACCRUAL").length,
      rows,
    };
  }

  public async createPreview(params: { periodStart: Date; periodEnd: Date; cutoffAt: Date }) {
    if (
      [params.periodStart, params.periodEnd, params.cutoffAt].some((date) => Number.isNaN(date.getTime())) ||
      params.periodStart > params.periodEnd ||
      params.cutoffAt < params.periodEnd
    ) {
      throw new BadRequestException("Período ou data de corte inválidos");
    }

    const existing = await this.prisma.payoutCycle.findUnique({
      where: {
        periodStart_periodEnd_cutoffAt: {
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          cutoffAt: params.cutoffAt,
        },
      },
    });
    if (existing) return this.getPreview(existing.id);

    await this.releaseSecurityPeriod({ cutoffAt: params.cutoffAt });
    const eligible = await this.prisma.commissionLedgerEntry.findMany({
      where: {
        status: "AVAILABLE",
        payoutCycleId: null,
        occurredAt: { gte: params.periodStart, lte: params.periodEnd },
        availableAt: { lte: params.cutoffAt },
      },
      orderBy: { occurredAt: "asc" },
    });

    const grouped = new Map<string, typeof eligible>();
    for (const entry of eligible) grouped.set(entry.issuerId, [...(grouped.get(entry.issuerId) ?? []), entry]);
    const wallets = await this.prisma.organizationWallet.findMany({
      where: { issuerId: { in: [...grouped.keys()] } },
    });
    const walletByIssuer = new Map(wallets.map((wallet) => [wallet.issuerId, wallet]));
    const now = new Date();
    const cycleId = Id.create("payout_cycle").value;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payoutCycle.create({
          data: { id: cycleId, ...params, status: "PREVIEW", createdAt: now, updatedAt: now },
        });
        for (const [issuerId, entries] of grouped) {
          const wallet = walletByIssuer.get(issuerId);
          const blockedReason = this.walletBlockReason(wallet);
          await tx.payoutCycleItem.create({
            data: {
              id: Id.create("payout_item").value,
              payoutCycleId: cycleId,
              issuerId,
              amountMinor: entries.reduce((sum, entry) => sum + entry.amountMinor, 0),
              entriesCount: entries.length,
              entryIds: entries.map((entry) => entry.id),
              blockedReason,
              walletAddress: wallet?.stellarAddress ?? null,
              createdAt: now,
            },
          });
          if (!blockedReason) {
            await tx.commissionLedgerEntry.updateMany({
              where: { id: { in: entries.map((entry) => entry.id) }, status: "AVAILABLE", payoutCycleId: null },
              data: { status: "ALLOCATED", payoutCycleId: cycleId },
            });
          }
        }
      });
    } catch (cause) {
      const raced = await this.prisma.payoutCycle.findUnique({
        where: {
          periodStart_periodEnd_cutoffAt: {
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
            cutoffAt: params.cutoffAt,
          },
        },
      });
      if (raced) return this.getPreview(raced.id);
      throw cause;
    }

    return this.getPreview(cycleId);
  }

  private async getPreview(id: string) {
    const cycle = await this.prisma.payoutCycle.findUnique({ where: { id } });
    if (!cycle) throw new BadRequestException("Ciclo de repasse não encontrado");
    const items = await this.prisma.payoutCycleItem.findMany({
      where: { payoutCycleId: id },
      orderBy: { issuerId: "asc" },
    });
    return {
      id: cycle.id,
      status: cycle.status,
      periodStart: cycle.periodStart.toISOString(),
      periodEnd: cycle.periodEnd.toISOString(),
      cutoffAt: cycle.cutoffAt.toISOString(),
      totalAmount: money(items.filter((item) => !item.blockedReason).reduce((sum, item) => sum + item.amountMinor, 0)),
      blockedAmount: money(items.filter((item) => item.blockedReason).reduce((sum, item) => sum + item.amountMinor, 0)),
      items: items.map((item) => ({
        issuerId: item.issuerId,
        amount: money(item.amountMinor),
        currency: "BRL" as const,
        entriesCount: item.entriesCount,
        entryIds: Array.isArray(item.entryIds) ? item.entryIds : [],
        walletAddress: item.walletAddress,
        blockedReason: item.blockedReason,
      })),
    };
  }

  private async releaseSecurityPeriod(params: { issuerId?: string; cutoffAt: Date }) {
    await this.prisma.commissionLedgerEntry.updateMany({
      where: {
        ...(params.issuerId ? { issuerId: params.issuerId } : {}),
        status: "PENDING_SECURITY",
        availableAt: { lte: params.cutoffAt },
      },
      data: { status: "AVAILABLE" },
    });
  }

  private walletBlockReason(wallet: {
    status: string;
    accountActivated: boolean;
    trustlineReady: boolean;
  } | undefined): string | null {
    if (!wallet) return "WALLET_NOT_PROVISIONED";
    if (wallet.status === "SUSPENDED") return "WALLET_SUSPENDED";
    if (wallet.status !== "ACTIVE") return "WALLET_NOT_ACTIVE";
    if (!wallet.accountActivated) return "STELLAR_ACCOUNT_NOT_ACTIVATED";
    if (!wallet.trustlineReady) return "ASSET_TRUSTLINE_NOT_READY";
    return null;
  }
}
