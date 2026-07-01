import { Injectable } from "@nestjs/common";
import { CredentialStatus } from "@src/infra/database/@prisma/generated/client";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

export interface CredentialListFilters {
  issuerId: string;
  status?: CredentialStatus;
  limit: number;
  cursorTs?: string;
  cursorId?: string;
}

@Injectable()
export class CredentialsBackofficeDao {
  public constructor(private readonly prismaService: PrismaService) {}

  public async list(filters: CredentialListFilters) {
    const where: Record<string, unknown> = { issuerId: filters.issuerId };
    if (filters.status) where.status = filters.status;

    if (filters.cursorTs && filters.cursorId) {
      where.OR = [
        { createdAt: { lt: new Date(filters.cursorTs) } },
        { AND: [{ createdAt: new Date(filters.cursorTs) }, { id: { lt: filters.cursorId } }] },
      ];
    }

    return this.prismaService.credential.findMany({
      where,
      take: filters.limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  public async countActive(issuerId: string): Promise<number> {
    return this.prismaService.credential.count({
      where: { issuerId, status: "ACTIVE" },
    });
  }

  public async countActiveAt(issuerId: string, at: Date): Promise<number> {
    return this.prismaService.credential.count({
      where: {
        issuerId,
        createdAt: { lte: at },
        OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
        status: { in: ["ACTIVE", "EXPIRED"] },
      },
    });
  }

  public async findById(issuerId: string, id: string) {
    return this.prismaService.credential.findFirst({
      where: { id, issuerId },
    });
  }
}
