import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "crypto";

interface ChallengeEntry {
  expiresAt: number;
}

// TODO: replace with Redis for multi-instance ECS deployments
@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);
  private readonly store = new Map<string, ChallengeEntry>();
  private readonly TTL_MS = 60_000;

  public generate(): { challenge: string; expiresAt: number } {
    const challenge = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + this.TTL_MS;

    this.store.set(challenge, { expiresAt });
    this.cleanup();

    this.logger.debug(`Challenge gerado — total ativos: ${this.store.size}`);
    return { challenge, expiresAt };
  }

  public consume(challenge: string): boolean {
    const entry = this.store.get(challenge);

    if (!entry) {
      this.logger.warn(`Challenge inválido ou já consumido: ${challenge.slice(0, 16)}...`);
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(challenge);
      this.logger.warn(`Challenge expirado: ${challenge.slice(0, 16)}...`);
      return false;
    }

    this.store.delete(challenge);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`GC: removidos ${removed} challenge(s) expirado(s)`);
    }
  }
}
