import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { EnvService } from "@src/infra/env/env.service";
import { Id } from "@src/shared/value-objects/id.value-object";
import { WalletService } from "@src/modules/wallet/wallet.service";

@Injectable()
export class PayoutRequestService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    private readonly walletService: WalletService,
  ) {}

  public async requestAllAvailable(issuerId: string, idempotencyKey: string) {
    if (!this.isSettlementConfigured()) {
      throw new BadRequestException("Repasse temporariamente indisponível enquanto a liquidação Stellar é configurada");
    }
    const normalizedKey = idempotencyKey.trim();
    if (normalizedKey.length < 8 || normalizedKey.length > 200) {
      throw new BadRequestException("Idempotency-Key deve conter entre 8 e 200 caracteres");
    }
    const idempotencyKeyHash = this.sha256(normalizedKey);
    const existing = await this.prisma.payoutRequest.findUnique({
      where: { issuerId_idempotencyKeyHash: { issuerId, idempotencyKeyHash } },
    });
    if (existing) return this.toResult(existing);
    await this.walletService.refreshOrganizationWalletReadiness(issuerId);

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const active = await tx.payoutRequest.findUnique({ where: { activeIssuerId: issuerId } });
        if (active) throw new ConflictException("Já existe um repasse em processamento para esta organização");

        const wallet = await tx.organizationWallet.findUnique({ where: { issuerId } });
        const walletBlock = this.walletBlockReason(wallet);
        if (walletBlock) throw new BadRequestException(walletBlock);

        const now = new Date();
        await tx.commissionLedgerEntry.updateMany({
          where: { issuerId, status: "PENDING_SECURITY", availableAt: { lte: now } },
          data: { status: "AVAILABLE" },
        });
        const entries = await tx.commissionLedgerEntry.findMany({
          where: { issuerId, status: "AVAILABLE", payoutRequestId: null, payoutCycleId: null },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        });
        if (entries.length === 0) throw new BadRequestException("Não há comissões disponíveis para receber");

        const amountMinor = entries.reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n);
        const requestId = Id.create("payout").value;
        const onChainPayoutId = this.sha256(`${this.env.NODE_ENV}:${requestId}`);
        const payout = await tx.payoutRequest.create({
          data: {
            id: requestId,
            issuerId,
            activeIssuerId: issuerId,
            walletId: wallet!.id,
            destinationAddress: wallet!.stellarAddress!,
            amountMinor,
            currency: "BRL",
            settlementAssetCode: wallet!.assetCode,
            settlementAssetIssuer: wallet!.assetIssuer,
            settlementAmountAtomic: this.toAtomicUnits(amountMinor),
            status: "REQUESTED",
            idempotencyKeyHash,
            onChainPayoutId,
            requestedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
        const reserved = await tx.commissionLedgerEntry.updateMany({
          where: { id: { in: entries.map((entry) => entry.id) }, status: "AVAILABLE", payoutRequestId: null },
          data: { status: "ALLOCATED", payoutRequestId: requestId },
        });
        if (reserved.count !== entries.length) {
          throw new ConflictException("O saldo mudou durante a solicitação; tente novamente");
        }
        return payout;
      });
    } catch (cause) {
      const raced = await this.prisma.payoutRequest.findUnique({
        where: { issuerId_idempotencyKeyHash: { issuerId, idempotencyKeyHash } },
      });
      if (raced) return this.toResult(raced);
      const active = await this.prisma.payoutRequest.findUnique({ where: { activeIssuerId: issuerId } });
      if (active) throw new ConflictException("Já existe um repasse em processamento para esta organização");
      throw cause;
    }
    return this.toResult(created);
  }

  public async list(issuerId: string, limit = 20) {
    const rows = await this.prisma.payoutRequest.findMany({
      where: { issuerId },
      orderBy: { requestedAt: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return { items: rows.map((row) => this.toResult(row)) };
  }

  public async get(issuerId: string, id: string) {
    const row = await this.prisma.payoutRequest.findFirst({ where: { id, issuerId } });
    if (!row) throw new NotFoundException("Repasse não encontrado");
    const attempts = await this.prisma.payoutAttempt.findMany({
      where: { payoutRequestId: id },
      orderBy: { attemptNumber: "asc" },
    });
    return {
      ...this.toResult(row),
      attempts: attempts.map((attempt) => ({
        number: attempt.attemptNumber,
        status: attempt.status,
        stellarTxHash: attempt.stellarTxHash,
        stellarLedger: attempt.stellarLedger,
        failureCode: attempt.failureCode,
        startedAt: attempt.startedAt.toISOString(),
        completedAt: attempt.completedAt?.toISOString() ?? null,
      })),
    };
  }

  public async getActive(issuerId: string) {
    const row = await this.prisma.payoutRequest.findUnique({ where: { activeIssuerId: issuerId } });
    return row ? this.toResult(row) : null;
  }

  public async getReadiness(issuerId: string) {
    await this.walletService.refreshOrganizationWalletReadiness(issuerId);
    const wallet = await this.prisma.organizationWallet.findUnique({ where: { issuerId } });
    const walletReason = this.walletBlockReason(wallet);
    const contractReady = this.isSettlementConfigured();
    return {
      ready: contractReady && !walletReason,
      contractReady,
      walletReady: !walletReason,
      reason: !contractReady ? "SETTLEMENT_NOT_CONFIGURED" : walletReason,
    };
  }

  private toAtomicUnits(amountMinor: bigint): bigint {
    const decimals = this.env.STELLAR_PAYOUT_ASSET_DECIMALS;
    if (decimals >= 2) return amountMinor * 10n ** BigInt(decimals - 2);
    const divisor = 10n ** BigInt(2 - decimals);
    if (amountMinor % divisor !== 0n) throw new BadRequestException("Valor não representável no ativo de liquidação");
    return amountMinor / divisor;
  }

  private walletBlockReason(
    wallet: {
      status: string;
      accountActivated: boolean;
      trustlineReady: boolean;
      controlVerifiedAt: Date | null;
      stellarAddress: string | null;
    } | null,
  ): string | null {
    if (!wallet) return "Carteira organizacional ainda não provisionada";
    if (wallet.status !== "ACTIVE") return "Carteira organizacional não está ativa";
    if (!wallet.accountActivated || !wallet.stellarAddress) return "Conta Stellar ainda não está ativada";
    if (!wallet.controlVerifiedAt) return "Controle da carteira ainda não foi confirmado no backoffice";
    if (!wallet.trustlineReady) return "Trustline do ativo de liquidação ainda não está pronta";
    return null;
  }

  private sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private isSettlementConfigured(): boolean {
    return this.env.STELLAR_PAYOUT_CONTRACT_ID !== "PLACEHOLDER" && this.env.STELLAR_PAYOUT_OPERATOR_SECRET.length > 0;
  }

  private toResult(row: {
    id: string;
    status: string;
    destinationAddress: string;
    amountMinor: bigint;
    currency: string;
    settlementAssetCode: string;
    settlementAmountAtomic: bigint;
    stellarTxHash: string | null;
    stellarLedger: number | null;
    failureCode: string | null;
    requestedAt: Date;
    submittedAt: Date | null;
    confirmedAt: Date | null;
  }) {
    return {
      id: row.id,
      status: row.status,
      destinationAddress: row.destinationAddress,
      amountMinor: row.amountMinor.toString(),
      amount: Number(row.amountMinor) / 100,
      currency: row.currency,
      settlementAssetCode: row.settlementAssetCode,
      settlementAmountAtomic: row.settlementAmountAtomic.toString(),
      stellarTxHash: row.stellarTxHash,
      stellarLedger: row.stellarLedger,
      failureCode: row.failureCode,
      requestedAt: row.requestedAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
    };
  }
}
