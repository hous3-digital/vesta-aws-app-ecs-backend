import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { EnvService } from "@src/infra/env/env.service";
import { Id } from "@src/shared/value-objects/id.value-object";
import {
  PayoutSettlementGateway,
  SettlementUnknownError,
  SettlementRejectedError,
} from "@src/modules/commission/payout-settlement.gateway";

@Injectable()
export class PayoutProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayoutProcessorService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PayoutSettlementGateway,
    private readonly env: EnvService,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => void this.processNext(), this.env.PAYOUT_PROCESSOR_INTERVAL_MS);
    this.timer.unref();
    void this.processNext();
  }

  public onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  public async processNext(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.markStaleProcessingUnknown();
      await this.reconcileNextUnknown();
      const candidate = await this.prisma.payoutRequest.findFirst({
        where: { status: "REQUESTED" },
        orderBy: { requestedAt: "asc" },
      });
      if (!candidate) return;
      const claimed = await this.prisma.payoutRequest.updateMany({
        where: { id: candidate.id, status: "REQUESTED" },
        data: { status: "PROCESSING", processingStartedAt: new Date(), updatedAt: new Date() },
      });
      if (claimed.count !== 1) return;

      const attemptNumber = (await this.prisma.payoutAttempt.count({ where: { payoutRequestId: candidate.id } })) + 1;
      const attempt = await this.prisma.payoutAttempt.create({
        data: {
          id: Id.create("payout_attempt").value,
          payoutRequestId: candidate.id,
          attemptNumber,
          status: "PROCESSING",
          startedAt: new Date(),
          createdAt: new Date(),
        },
      });

      try {
        const settled = await this.gateway.settle({
          payoutId: candidate.onChainPayoutId,
          destinationAddress: candidate.destinationAddress,
          amountAtomic: candidate.settlementAmountAtomic,
        });
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
          await tx.payoutAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "CONFIRMED",
              stellarTxHash: settled.txHash,
              stellarLedger: settled.ledger,
              completedAt: now,
            },
          });
          await tx.payoutRequest.update({
            where: { id: candidate.id },
            data: {
              status: "CONFIRMED",
              activeIssuerId: null,
              stellarTxHash: settled.txHash,
              stellarLedger: settled.ledger,
              submittedAt: now,
              confirmedAt: now,
              updatedAt: now,
            },
          });
          await tx.commissionLedgerEntry.updateMany({
            where: { payoutRequestId: candidate.id, status: "ALLOCATED" },
            data: { status: "SETTLED", settledAt: now },
          });
        });
      } catch (cause) {
        const rejected = cause instanceof SettlementRejectedError;
        const txHash = cause instanceof SettlementUnknownError ? cause.txHash : null;
        const unknownStatus = txHash ? "UNKNOWN" : "REQUIRES_REVIEW";
        const now = new Date();
        const failureCode = rejected ? cause.code : "SETTLEMENT_RESULT_UNKNOWN";
        await this.prisma.$transaction([
          this.prisma.payoutAttempt.update({
            where: { id: attempt.id },
            data: {
              status: rejected ? "FAILED" : "UNKNOWN",
              stellarTxHash: txHash,
              failureCode,
              completedAt: now,
            },
          }),
          this.prisma.payoutRequest.update({
            where: { id: candidate.id },
            data: {
              status: rejected ? "FAILED" : unknownStatus,
              activeIssuerId: rejected ? null : candidate.issuerId,
              stellarTxHash: txHash,
              submittedAt: txHash ? now : null,
              failureCode,
              updatedAt: now,
            },
          }),
          ...(rejected
            ? [
                this.prisma.commissionLedgerEntry.updateMany({
                  where: { payoutRequestId: candidate.id, status: "ALLOCATED" },
                  data: { status: "AVAILABLE", payoutRequestId: null },
                }),
              ]
            : []),
        ]);
        this.logger.error(`Repasse ${candidate.id} ${rejected ? "falhou" : "requer conciliação"}: ${failureCode}`);
      }
    } finally {
      this.running = false;
    }
  }

  private async markStaleProcessingUnknown(): Promise<void> {
    const staleBefore = new Date(Date.now() - 5 * 60_000);
    const stale = await this.prisma.payoutRequest.findMany({
      where: { status: "PROCESSING", processingStartedAt: { lt: staleBefore } },
      select: { id: true },
    });
    if (stale.length === 0) return;
    const ids = stale.map(({ id }) => id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.payoutRequest.updateMany({
        where: { id: { in: ids }, status: "PROCESSING" },
        data: { status: "REQUIRES_REVIEW", failureCode: "PROCESSOR_INTERRUPTED", updatedAt: now },
      }),
      this.prisma.payoutAttempt.updateMany({
        where: { payoutRequestId: { in: ids }, status: "PROCESSING" },
        data: { status: "UNKNOWN", failureCode: "PROCESSOR_INTERRUPTED", completedAt: now },
      }),
    ]);
  }

  private async reconcileNextUnknown(): Promise<void> {
    const payout = await this.prisma.payoutRequest.findFirst({
      where: { status: "UNKNOWN", stellarTxHash: { not: null } },
      orderBy: { updatedAt: "asc" },
    });
    if (!payout?.stellarTxHash) return;

    const result = await this.gateway.reconcile(payout.stellarTxHash);
    if (result.status === "PENDING") return;
    const now = new Date();
    const confirmed = result.status === "CONFIRMED";
    await this.prisma.$transaction([
      this.prisma.payoutAttempt.updateMany({
        where: { payoutRequestId: payout.id, stellarTxHash: payout.stellarTxHash, status: "UNKNOWN" },
        data: {
          status: confirmed ? "CONFIRMED" : "FAILED",
          stellarLedger: confirmed ? result.ledger : null,
          failureCode: confirmed ? null : "SETTLEMENT_FAILED_ON_CHAIN",
          completedAt: now,
        },
      }),
      this.prisma.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: confirmed ? "CONFIRMED" : "FAILED",
          activeIssuerId: null,
          stellarLedger: confirmed ? result.ledger : null,
          failureCode: confirmed ? null : "SETTLEMENT_FAILED_ON_CHAIN",
          confirmedAt: confirmed ? now : null,
          updatedAt: now,
        },
      }),
      this.prisma.commissionLedgerEntry.updateMany({
        where: { payoutRequestId: payout.id, status: "ALLOCATED" },
        data: confirmed
          ? { status: "SETTLED", settledAt: now }
          : { status: "AVAILABLE", payoutRequestId: null },
      }),
    ]);
    this.logger.log(`Repasse ${payout.id} conciliado como ${result.status}`);
  }
}
