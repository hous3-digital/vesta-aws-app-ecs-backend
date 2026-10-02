import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { IPrepareSessionStore, PrepareSession } from "@src/modules/proof/domain/prepare-session.store";
import { hashPrepareSessionId, newPrepareSessionId } from "@src/modules/proof/infra/prepare-session-key";
import { PrepareSessionMapper } from "@src/modules/proof/infra/prepare-session.mapper";

/**
 * The store every deployed environment runs today (no REDIS_URL, TD-020). Same shape as the
 * challenge table: the row is keyed by the hash of the id, expired rows are swept on every
 * write, and consuming is a single conditional delete so two concurrent submits cannot both win.
 */
@Injectable()
export class PrepareSessionPostgresStore extends IPrepareSessionStore {
  private readonly logger = new Logger(PrepareSessionPostgresStore.name);

  public constructor(private readonly prisma: PrismaService) {
    super();
  }

  public async create(session: PrepareSession, ttlSeconds: number): Promise<string> {
    const sessionId = newPrepareSessionId();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.prisma.prepareSession.create({
      data: PrepareSessionMapper.toCreateInput(hashPrepareSessionId(sessionId), session, expiresAt),
    });
    await this.sweepExpired();
    return sessionId;
  }

  public async consume(sessionId: string): Promise<PrepareSession | null> {
    const sessionHash = hashPrepareSessionId(sessionId);
    const row = await this.prisma.prepareSession.findUnique({ where: { sessionHash } });
    if (!row) return null;

    // The delete is the consumption: whoever deletes the row owns the session, expired or not.
    const consumed = await this.prisma.prepareSession.deleteMany({ where: { sessionHash } });
    if (consumed.count !== 1) {
      this.logger.warn("Prepare session consumed concurrently");
      return null;
    }
    if (row.expiresAt.getTime() < Date.now()) {
      this.logger.warn("Prepare session expired");
      return null;
    }
    return PrepareSessionMapper.toDomain(row);
  }

  /** Housekeeping, never a reason to fail the prepare: a failure is logged and the next write retries it. */
  private async sweepExpired(): Promise<void> {
    try {
      await this.prisma.prepareSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch (cause) {
      this.logger.warn(`Expired prepare sessions were not swept: ${(cause as Error).message}`);
    }
  }
}
