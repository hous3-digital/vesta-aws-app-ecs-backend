import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { EnvService } from "@src/infra/env/env.service";
import {
  CommissionRegistrationGateway,
  CommissionRegistrationRejectedError,
  CommissionRegistrationUnknownError,
} from "@src/modules/commission/commission-registration.gateway";
import {
  commissionBeneficiaryId,
  commissionCreditId,
  minorToAtomicUnits,
} from "@src/modules/commission/commission-onchain-identifiers";

@Injectable()
export class CommissionRegistrationProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommissionRegistrationProcessorService.name);
  private timer: ReturnType<typeof globalThis.setInterval> | null = null;
  private running = false;

  public constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: CommissionRegistrationGateway,
    private readonly env: EnvService,
  ) {}

  public onModuleInit(): void {
    this.timer = globalThis.setInterval(
      () => void this.processNext(),
      this.env.COMMISSION_REGISTRATION_PROCESSOR_INTERVAL_MS,
    );
    this.timer.unref();
    void this.processNext();
  }

  public onModuleDestroy(): void {
    if (this.timer) globalThis.clearInterval(this.timer);
  }

  public async processNext(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.releaseStaleClaims();
      await this.reconcileUnknown();
      const candidate = await this.prisma.commissionLedgerEntry.findFirst({
        where: { entryType: "ACCRUAL", onChainStatus: "PENDING" },
        orderBy: { createdAt: "asc" },
      });
      if (!candidate) return;

      const creditId = candidate.onChainCreditId ?? commissionCreditId(candidate.id);
      const beneficiaryId = candidate.onChainBeneficiaryId ?? commissionBeneficiaryId(candidate.issuerId);
      const amountAtomic =
        candidate.onChainAmountAtomic ??
        minorToAtomicUnits(BigInt(candidate.amountMinor), this.env.STELLAR_PAYOUT_ASSET_DECIMALS);
      const claimedAt = new Date();
      const claimed = await this.prisma.commissionLedgerEntry.updateMany({
        where: { id: candidate.id, onChainStatus: "PENDING" },
        data: {
          onChainStatus: "PROCESSING",
          onChainCreditId: creditId,
          onChainBeneficiaryId: beneficiaryId,
          onChainAmountAtomic: amountAtomic,
          onChainFailureCode: null,
          onChainUpdatedAt: claimedAt,
        },
      });
      if (claimed.count !== 1) return;

      try {
        const result = await this.gateway.register({ creditId, beneficiaryId, amountAtomic });
        const confirmedAt = new Date();
        await this.prisma.commissionLedgerEntry.update({
          where: { id: candidate.id },
          data: {
            onChainStatus: "CONFIRMED",
            onChainTxHash: result.txHash,
            onChainLedger: result.ledger,
            onChainCreditedAt: confirmedAt,
            onChainFailureCode: null,
            onChainUpdatedAt: confirmedAt,
          },
        });
      } catch (cause) {
        await this.handleFailure(candidate.id, cause);
      }
    } finally {
      this.running = false;
    }
  }

  private async releaseStaleClaims(): Promise<void> {
    await this.prisma.commissionLedgerEntry.updateMany({
      where: {
        onChainStatus: "PROCESSING",
        onChainUpdatedAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
      data: {
        onChainStatus: "PENDING",
        onChainFailureCode: "PROCESSOR_INTERRUPTED",
        onChainUpdatedAt: new Date(),
      },
    });
  }

  private async reconcileUnknown(): Promise<void> {
    const entry = await this.prisma.commissionLedgerEntry.findFirst({
      where: { onChainStatus: "UNKNOWN", onChainTxHash: { not: null } },
      orderBy: { onChainUpdatedAt: "asc" },
    });
    if (!entry?.onChainTxHash) return;
    const result = await this.gateway.reconcile(entry.onChainTxHash);
    if (result.status === "PENDING") return;
    const now = new Date();
    await this.prisma.commissionLedgerEntry.update({
      where: { id: entry.id },
      data:
        result.status === "CONFIRMED"
          ? {
              onChainStatus: "CONFIRMED",
              onChainLedger: result.ledger,
              onChainCreditedAt: now,
              onChainFailureCode: null,
              onChainUpdatedAt: now,
            }
          : {
              onChainStatus: "PENDING",
              onChainTxHash: null,
              onChainFailureCode: "CREDIT_FAILED_ON_CHAIN",
              onChainUpdatedAt: now,
            },
    });
  }

  private async handleFailure(entryId: string, cause: unknown): Promise<void> {
    const rejected = cause instanceof CommissionRegistrationRejectedError;
    const mismatch = rejected && cause.code === "CREDIT_MISMATCH";
    const txHash = cause instanceof CommissionRegistrationUnknownError ? cause.txHash : null;
    const failureCode = rejected ? cause.code : "CREDIT_RESULT_UNKNOWN";
    await this.prisma.commissionLedgerEntry.update({
      where: { id: entryId },
      data: {
        onChainStatus: mismatch ? "REQUIRES_REVIEW" : txHash ? "UNKNOWN" : "PENDING",
        onChainTxHash: txHash,
        onChainFailureCode: failureCode,
        onChainUpdatedAt: new Date(),
      },
    });
    this.logger.error(`Registro on-chain da comissão ${entryId} não confirmado: ${failureCode}`);
  }
}
