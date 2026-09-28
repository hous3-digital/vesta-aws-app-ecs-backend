import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const SECRET_PREFIX = "vesta_live_";
const SECRET_RANDOM_BYTES = 24;
/** `vesta_live_` plus the first 8 hex characters: enough to tell keys apart, never enough to use one. */
const DISPLAY_PREFIX_LENGTH = SECRET_PREFIX.length + 8;

/**
 * The secret half of an API key. It is generated once, shown to the issuer
 * once, and kept only as its SHA-256 hash plus a displayable prefix. The
 * guard rebuilds it from the request header to look the row up by hash.
 *
 * SHA-256 without salt and without a slow KDF is deliberate: the secret
 * carries 192 random bits, so precomputation is not a threat, and the lookup
 * needs an indexed, deterministic hash (`app/docs/decisions.md`, 2026-09-28).
 */
export class ApiKeySecret {
  private readonly hashValue: string;

  private constructor(private readonly raw: string) {
    this.hashValue = createHash("sha256").update(raw, "utf8").digest("hex");
  }

  /** The clear secret. Read once to build the creation response, never stored or logged. */
  public get value(): string {
    return this.raw;
  }

  public get hash(): string {
    return this.hashValue;
  }

  public get prefix(): string {
    return this.raw.slice(0, DISPLAY_PREFIX_LENGTH);
  }

  public static generate(): ApiKeySecret {
    return new ApiKeySecret(`${SECRET_PREFIX}${randomBytes(SECRET_RANDOM_BYTES).toString("hex")}`);
  }

  /** A candidate presented by a caller. Not validated: any string may be tried and compared by hash. */
  public static fromRaw(raw: string): ApiKeySecret {
    return new ApiKeySecret(raw);
  }

  /** Constant-time comparison of this secret's hash with a stored hash; lengths that differ are a mismatch. */
  public matchesHash(storedHash: string): boolean {
    const candidate = Buffer.from(this.hash, "utf8");
    const stored = Buffer.from(storedHash, "utf8");
    if (candidate.length !== stored.length) return false;
    return timingSafeEqual(candidate, stored);
  }
}
