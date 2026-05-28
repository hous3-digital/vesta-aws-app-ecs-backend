import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { randomBytes } from "crypto";
import Redis from "ioredis";

const CHALLENGE_TTL_SECONDS = 60;
const CHALLENGE_PREFIX = "challenge:";

@Injectable()
export class ChallengeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChallengeService.name);
  private redis: Redis | null = null;
  private readonly memoryStore = new Map<string, number>();

  public constructor(private readonly envService: EnvService) {}

  public async onModuleInit(): Promise<void> {
    const redisUrl = this.envService.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn("REDIS_URL não configurado — challenge store rodando em memória (não escala com múltiplas instâncias)");
      return;
    }

    try {
      this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
      await this.redis.connect();
      this.logger.log("Challenge store conectado ao Redis");
    } catch (err) {
      this.logger.error(`Falha ao conectar ao Redis: ${(err as Error).message} — fallback para memória`);
      this.redis?.disconnect();
      this.redis = null;
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  public async generate(): Promise<{ challenge: string; expiresAt: number }> {
    const challenge = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + CHALLENGE_TTL_SECONDS * 1000;

    if (this.redis) {
      await this.redis.set(`${CHALLENGE_PREFIX}${challenge}`, "1", "EX", CHALLENGE_TTL_SECONDS);
    } else {
      this.memoryStore.set(challenge, expiresAt);
      this.cleanup();
    }

    this.logger.debug("Challenge gerado");
    return { challenge, expiresAt };
  }

  public async consume(challenge: string): Promise<boolean> {
    if (this.redis) {
      const deleted = await this.redis.del(`${CHALLENGE_PREFIX}${challenge}`);
      if (deleted === 0) {
        this.logger.warn(`Challenge inválido ou já consumido: ${challenge.slice(0, 16)}...`);
        return false;
      }
      return true;
    }

    const expiresAt = this.memoryStore.get(challenge);
    if (expiresAt === undefined) {
      this.logger.warn(`Challenge inválido ou já consumido: ${challenge.slice(0, 16)}...`);
      return false;
    }

    this.memoryStore.delete(challenge);

    if (Date.now() > expiresAt) {
      this.logger.warn(`Challenge expirado: ${challenge.slice(0, 16)}...`);
      return false;
    }

    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.memoryStore) {
      if (now > expiresAt) this.memoryStore.delete(key);
    }
  }
}
