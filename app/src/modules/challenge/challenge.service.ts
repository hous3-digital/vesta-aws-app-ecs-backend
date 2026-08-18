import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { randomBytes } from "crypto";
import Redis from "ioredis";

const CHALLENGE_TTL_SECONDS = 60;
const CHALLENGE_PREFIX = "challenge:";

export type ChallengeContext =
  | { kind: "legacy" }
  | { kind: "passkey-registration"; issuerId: string; rpId: string; vcHash: string }
  | { kind: "passkey-authentication"; issuerId: string; rpId: string }
  | { kind: "proof"; issuerId: string; vcHash: string };

interface StoredChallenge {
  expiresAt: number;
  context: ChallengeContext;
}

@Injectable()
export class ChallengeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChallengeService.name);
  private redis: Redis | null = null;
  private readonly memoryStore = new Map<string, StoredChallenge>();

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

  public async generate(context: ChallengeContext = { kind: "legacy" }): Promise<{ challenge: string; expiresAt: number }> {
    // Mantém o formato hexadecimal do endpoint legado. Hex também é uma
    // string base64url canônica, portanto funciona nas options WebAuthn JSON.
    const challenge = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + CHALLENGE_TTL_SECONDS * 1000;
    const stored: StoredChallenge = { expiresAt, context };

    if (this.redis) {
      await this.redis.set(`${CHALLENGE_PREFIX}${challenge}`, JSON.stringify(stored), "EX", CHALLENGE_TTL_SECONDS);
    } else {
      this.memoryStore.set(challenge, stored);
      this.cleanup();
    }

    this.logger.debug("Challenge gerado");
    return { challenge, expiresAt };
  }

  public async consume(challenge: string): Promise<boolean> {
    return (await this.consumeContext(challenge)) !== null;
  }

  public async consumeContext(challenge: string): Promise<ChallengeContext | null> {
    if (this.redis) {
      const key = `${CHALLENGE_PREFIX}${challenge}`;
      const transaction = await this.redis.multi().get(key).del(key).exec();
      const raw = transaction?.[0]?.[1];
      if (typeof raw !== "string") {
        this.logger.warn(`Challenge inválido ou já consumido: ${challenge.slice(0, 16)}...`);
        return null;
      }
      const stored = JSON.parse(raw) as StoredChallenge;
      return Date.now() <= stored.expiresAt ? stored.context : null;
    }

    const stored = this.memoryStore.get(challenge);
    if (!stored) {
      this.logger.warn(`Challenge inválido ou já consumido: ${challenge.slice(0, 16)}...`);
      return null;
    }

    this.memoryStore.delete(challenge);

    if (Date.now() > stored.expiresAt) {
      this.logger.warn(`Challenge expirado: ${challenge.slice(0, 16)}...`);
      return null;
    }

    return stored.context;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, stored] of this.memoryStore) {
      if (now > stored.expiresAt) this.memoryStore.delete(key);
    }
  }
}
