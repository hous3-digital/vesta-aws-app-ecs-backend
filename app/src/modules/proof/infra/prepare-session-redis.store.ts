import { OnModuleDestroy } from "@nestjs/common";
import { IPrepareSessionStore, PrepareSession } from "@src/modules/proof/domain/prepare-session.store";
import { hashPrepareSessionId, newPrepareSessionId } from "@src/modules/proof/infra/prepare-session-key";
import { PrepareSessionMapper } from "@src/modules/proof/infra/prepare-session.mapper";
import type Redis from "ioredis";

const KEY_PREFIX = "proof-prepare:";

/**
 * The store when REDIS_URL is set (local compose today, TD-020 for the deployed environments).
 * The TTL is Redis' own expiry and consuming is one `GETDEL`, atomic by construction.
 */
export class PrepareSessionRedisStore extends IPrepareSessionStore implements OnModuleDestroy {
  public constructor(private readonly redis: Redis) {
    super();
  }

  public async create(session: PrepareSession, ttlSeconds: number): Promise<string> {
    const sessionId = newPrepareSessionId();
    await this.redis.set(this.keyOf(sessionId), JSON.stringify(session), "EX", ttlSeconds);
    return sessionId;
  }

  public async consume(sessionId: string): Promise<PrepareSession | null> {
    const raw = await this.redis.getdel(this.keyOf(sessionId));
    return raw === null ? null : PrepareSessionMapper.fromJson(raw);
  }

  public async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private keyOf(sessionId: string): string {
    return `${KEY_PREFIX}${hashPrepareSessionId(sessionId)}`;
  }
}
