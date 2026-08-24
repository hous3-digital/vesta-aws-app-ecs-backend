import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EnvService } from "@src/infra/env/env.service";
import { createHash, randomBytes } from "crypto";
import Redis from "ioredis";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";

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

    try {
      this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
      await this.redis.connect();
      this.logger.log("Challenge store conectado ao Redis");
    } catch (err) {
      this.logger.error(`Falha ao conectar ao Redis: ${(err as Error).message} — fallback para PostgreSQL`);
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
      await this.prisma.authChallenge.create({
        data: {
          challengeHash: this.hash(challenge),
          context: context as object,
          expiresAt: new Date(expiresAt),
          createdAt: new Date(),
        },
      });
      void this.prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
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

    const challengeHash = this.hash(challenge);
    const stored = await this.prisma.authChallenge.findUnique({ where: { challengeHash } });
    if (!stored || stored.expiresAt.getTime() < Date.now()) {
      if (stored) await this.prisma.authChallenge.deleteMany({ where: { challengeHash } });
      this.logger.warn(`Challenge inválido ou já consumido: ${challenge.slice(0, 16)}...`);
      return null;
    }
    const consumed = await this.prisma.authChallenge.deleteMany({ where: { challengeHash } });
    if (consumed.count !== 1) {
      this.logger.warn(`Challenge já consumido concorrentemente: ${challenge.slice(0, 16)}...`);
      return null;
    }
    return stored.context as ChallengeContext;
  }

  private hash(challenge: string): string {
    return createHash("sha256").update(challenge).digest("hex");
  }
}
