import { Injectable } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

export interface VerificationListFilters {
  issuerId: string;
  verifierId?: string;
  status?: "completed" | "failed";
  from?: Date;
  to?: Date;
  limit: number;
  cursorTs?: string;
  cursorId?: string;
}

export interface VerificationRecord {
  id: string;
  vcHash: string;
  proofHash: string;
  verifierId: string;
  kycLevel: string;
  sorobanTxHash: string | null;
  sorobanLedger: number | null;
  onChainResult: boolean;
  createdAt: Date;
  credentialIssuerId: string | null;
}

const STATUS_FILTERS: Record<"completed" | "failed", boolean> = {
  completed: true,
  failed: false,
};

@Injectable()
export class VerificationsBackofficeDao {
  public constructor(private readonly prismaService: PrismaService) {}

  /**
   * Lista attestations cujo vcHash pertence a uma credencial do issuer.
   * Como o schema usa relationMode=prisma (sem FK), JOIN logico aqui:
   * 1. busca vcHashes do issuer
   * 2. filtra attestations por esses vcHashes
   */
  public async list(filters: VerificationListFilters): Promise<VerificationRecord[]> {
    const vcHashes = await this.collectVcHashesForIssuer(filters.issuerId);
    if (vcHashes.size === 0) return [];

    const where: Record<string, unknown> = { vcHash: { in: Array.from(vcHashes) } };
    if (filters.verifierId) where.verifierId = filters.verifierId;
    if (filters.status) where.onChainResult = STATUS_FILTERS[filters.status];
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    if (filters.cursorTs && filters.cursorId) {
      where.OR = [
        { createdAt: { lt: new Date(filters.cursorTs) } },
        { AND: [{ createdAt: new Date(filters.cursorTs) }, { id: { lt: filters.cursorId } }] },
      ];
    }

    const records = await this.prismaService.attestation.findMany({
      where,
      take: filters.limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return records.map((r) => ({
      id: r.id,
      vcHash: r.vcHash,
      proofHash: r.proofHash,
      verifierId: r.verifierId,
      kycLevel: r.kycLevel,
      sorobanTxHash: r.sorobanTxHash,
      sorobanLedger: r.sorobanLedger,
      onChainResult: r.onChainResult,
      createdAt: r.createdAt,
      credentialIssuerId: filters.issuerId,
    }));
  }

  public async findById(issuerId: string, id: string): Promise<VerificationRecord | null> {
    const record = await this.prismaService.attestation.findUnique({ where: { id } });
    if (!record) return null;

    const credential = await this.prismaService.credential.findFirst({
      where: { vcHash: record.vcHash, issuerId },
      select: { issuerId: true },
    });
    if (!credential) return null;

    return {
      id: record.id,
      vcHash: record.vcHash,
      proofHash: record.proofHash,
      verifierId: record.verifierId,
      kycLevel: record.kycLevel,
      sorobanTxHash: record.sorobanTxHash,
      sorobanLedger: record.sorobanLedger,
      onChainResult: record.onChainResult,
      createdAt: record.createdAt,
      credentialIssuerId: credential.issuerId,
    };
  }

  public async countByIssuer(issuerId: string, from: Date, to: Date): Promise<number> {
    const vcHashes = await this.collectVcHashesForIssuer(issuerId);
    if (vcHashes.size === 0) return 0;
    return this.prismaService.attestation.count({
      where: {
        vcHash: { in: Array.from(vcHashes) },
        createdAt: { gte: from, lte: to },
      },
    });
  }

  /**
   * Conta attestations por dia (UTC) no periodo. Usa $queryRaw porque Prisma
   * nao tem groupBy por funcao de data sem helpers.
   */
  public async dailyCount(issuerId: string, from: Date, to: Date): Promise<Array<{ date: string; count: number }>> {
    const vcHashes = await this.collectVcHashesForIssuer(issuerId);
    if (vcHashes.size === 0) return [];

    const rows = await this.prismaService.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT date_trunc('day', "created_at") AS day, COUNT(*)::bigint AS count
      FROM "attestation"
      WHERE "vc_hash" = ANY(${Array.from(vcHashes)}::text[])
        AND "created_at" >= ${from}
        AND "created_at" <= ${to}
      GROUP BY day
      ORDER BY day ASC;
    `;

    return rows.map((r) => ({
      date: r.day.toISOString().slice(0, 10),
      count: Number(r.count),
    }));
  }

  private async collectVcHashesForIssuer(issuerId: string): Promise<Set<string>> {
    const credentials = await this.prismaService.credential.findMany({
      where: { issuerId },
      select: { vcHash: true },
    });
    return new Set(credentials.map((c) => c.vcHash));
  }
}
