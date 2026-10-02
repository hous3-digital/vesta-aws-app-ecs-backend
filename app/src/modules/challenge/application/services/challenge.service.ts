import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { connectRedis } from "@src/infra/redis/redis-client.factory";
import { sha256Hex } from "@src/shared/crypto/sha256-hex";
import { randomBytes } from "crypto";
import type Redis from "ioredis";

const DEFAULT_CHALLENGE_TTL_SECONDS = 60;
const CHALLENGE_PREFIX = "challenge:";

export type ChallengeContext =
  | { kind: "legacy" }
  | { kind: "passkey-registration"; issuerId: string; rpId: string; vcHash: string }
  | { kind: "passkey-authentication"; issuerId: string; rpId: string }
  | { kind: "credential-recovery"; issuerId: string; rpId: string; vcHash: string }
  | { kind: "proof"; issuerId: string; vcHash: string }
  | {
      kind: "organization-wallet-control";
      issuerId: string;
      userId: string;
      walletAddress: string;
    };

interface StoredChallenge {
  expiresAt: number;
  context: ChallengeContext;
}

@Injectable()
export class ChallengeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChallengeService.name);
  private redis: Redis | null = null;

  public constructor(
    private readonly envService: EnvService,
    private readonly prisma: PrismaService,
  ) {}

  public async onModuleInit(): Promise<void> {
    const redisUrl = this.envService.REDIS_URL;
    if (!redisUrl) {
      this.logger.log("REDIS_URL não configurado — challenge store compartilhado usando PostgreSQL");
      return;
    }

    // A configured Redis that does not answer fails the boot (2026-10-02); no silent fallback to Postgres.
    this.redis = await connectRedis(redisUrl);
    this.logger.log("Challenge store: Redis");
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  public async generate(
    context: ChallengeContext = { kind: "legacy" },
    ttlSeconds = DEFAULT_CHALLENGE_TTL_SECONDS,
  ): Promise<{ challenge: string; expiresAt: number }> {
    // Mantém o formato hexadecimal exposto pelo endpoint legado. WebAuthn
    // persiste separadamente o Base64URL produzido pela biblioteca.
    const challenge = randomBytes(32).toString("hex");
    return this.store(challenge, context, ttlSeconds);
  }

  /**
   * Persiste um challenge produzido por outro protocolo sem alterar sua
   * representação. WebAuthn usa este caminho porque o SimpleWebAuthn devolve
   * o challenge em Base64URL; o valor armazenado deve ser exatamente o mesmo
   * que o navegador devolverá na etapa de verificação.
   */
  public async store(
    challenge: string,
    context: ChallengeContext,
    ttlSeconds = DEFAULT_CHALLENGE_TTL_SECONDS,
  ): Promise<{ challenge: string; expiresAt: number }> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const stored: StoredChallenge = { expiresAt, context };

    if (this.redis) {
      await this.redis.set(`${CHALLENGE_PREFIX}${challenge}`, JSON.stringify(stored), "EX", ttlSeconds);
    } else {
      await this.prisma.authChallenge.create({
        data: {
          challengeHash: this.hash(challenge),
          context: context as object,
          expiresAt: new Date(expiresAt),
          createdAt: new Date(),
        },
      });
      await this.sweepExpired();
    }

    this.logger.debug("Challenge gerado");
    return { challenge, expiresAt };
  }

  public async consume(challenge: string): Promise<boolean> {
    return (await this.consumeContext(challenge)) !== null;
  }

  public async consumeContext(challenge: string): Promise<ChallengeContext | null> {
    if (this.redis) {
      const raw = await this.redis.getdel(`${CHALLENGE_PREFIX}${challenge}`);
      if (raw === null) {
        this.logger.warn("Challenge invalid or already consumed");
        return null;
      }
      const stored = JSON.parse(raw) as StoredChallenge;
      return Date.now() <= stored.expiresAt ? stored.context : null;
    }

    const challengeHash = this.hash(challenge);
    const stored = await this.prisma.authChallenge.findUnique({ where: { challengeHash } });
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      if (stored) await this.prisma.authChallenge.deleteMany({ where: { challengeHash } });
      this.logger.warn("Challenge invalid or already consumed");
      return null;
    }
    const consumed = await this.prisma.authChallenge.deleteMany({ where: { challengeHash } });
    if (consumed.count !== 1) {
      this.logger.warn("Challenge already consumed concurrently");
      return null;
    }
    return stored.context as ChallengeContext;
  }

  /** Housekeeping, never a reason to fail the challenge: a failure is logged and the next write retries it. */
  private async sweepExpired(): Promise<void> {
    try {
      await this.prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch (cause) {
      this.logger.warn(`Expired challenges were not swept: ${(cause as Error).message}`);
    }
  }

  private hash(challenge: string): string {
    return sha256Hex(challenge);
  }
}
