import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import type { VestaVC } from "@src/shared/types/vesta-vc.types";
import { randomBytes } from "crypto";
import Redis from "ioredis";

export interface PrepareSessionData {
  vcHash: string;
  proofHash: string;
  kycLevel: string;
  verifierId: string;
  issuerId: string | null;
  userWalletAddress: string | null;
  expectedSource: string; // Stellar address that must sign the inner tx (deployer OR user)
  innerTxHash: string;
  sourceAccountSignedByBackend: boolean;
  vc: VestaVC;
  mock: boolean;
  zkProof: {
    protocol: string;
    curve: string;
    publicSignals: string[];
  };
}

const PREPARE_SESSION_TTL_SECONDS = 90;
const PREPARE_SESSION_PREFIX = "proof-prepare:";

@Injectable()
export class PrepareSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrepareSessionService.name);
  private redis: Redis | null = null;
  private readonly memoryStore = new Map<string, { data: PrepareSessionData; expiresAt: number }>();

  public constructor(private readonly envService: EnvService) {}

  public async onModuleInit(): Promise<void> {
    const redisUrl = this.envService.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn("REDIS_URL ausente — prepare sessions rodando em memória (não escalável)");
      return;
    }

    try {
      this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
      await this.redis.connect();
      this.logger.log("Prepare session store conectado ao Redis");
    } catch (err) {
      this.logger.error(`Falha conectar Redis: ${(err as Error).message} — fallback memória`);
      this.redis?.disconnect();
      this.redis = null;
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  public async create(data: PrepareSessionData): Promise<string> {
    const sessionId = `prep_${randomBytes(16).toString("hex")}`;

    if (this.redis) {
      await this.redis.set(
        `${PREPARE_SESSION_PREFIX}${sessionId}`,
        JSON.stringify(data),
        "EX",
        PREPARE_SESSION_TTL_SECONDS,
      );
    } else {
      this.memoryStore.set(sessionId, {
        data,
        expiresAt: Date.now() + PREPARE_SESSION_TTL_SECONDS * 1000,
      });
      this.cleanup();
    }

    return sessionId;
  }

  public async consume(sessionId: string): Promise<PrepareSessionData | null> {
    if (this.redis) {
      const key = `${PREPARE_SESSION_PREFIX}${sessionId}`;
      const raw = await this.redis.get(key);
      if (!raw) return null;
      await this.redis.del(key);
      return JSON.parse(raw) as PrepareSessionData;
    }

    const entry = this.memoryStore.get(sessionId);
    if (!entry) return null;
    this.memoryStore.delete(sessionId);
    if (Date.now() > entry.expiresAt) return null;
    return entry.data;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore) {
      if (now > entry.expiresAt) this.memoryStore.delete(key);
    }
  }
}
