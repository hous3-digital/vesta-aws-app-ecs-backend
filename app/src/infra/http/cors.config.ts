import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

/** Explicit lists, never a wildcard (`standard-security`, CORS). The write methods are what the backoffice needs (#356). */
export const CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

/** `X-Admin-Secret` stays out on purpose: admin routes are not called from a browser. */
export const CORS_ALLOWED_HEADERS = ["Authorization", "Content-Type", "X-Api-Key", "Idempotency-Key"] as const;

/** Seconds a browser may reuse a preflight answer (`Access-Control-Max-Age`), so one `OPTIONS` covers ten minutes of writes. */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

const HOST_CHARACTERS = "[a-z0-9.-]+";

/**
 * Parses `CORS_ALLOWED_ORIGINS`: comma-separated, each entry an exact origin or a wildcard pattern.
 * A wildcard matches host characters only and the pattern is anchored, so `https://*.example.com`
 * never matches `https://app.example.com.evil.net`.
 */
export function parseCorsOrigins(raw: string): Array<string | RegExp> {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => (entry.includes("*") ? toAnchoredPattern(entry) : entry));
}

/**
 * The CORS policy for every deployed environment. No credentials: the backoffice sends a bearer
 * header and the SDK an API key, nothing relies on cookies.
 */
export function buildCorsOptions(allowedOrigins: string): CorsOptions {
  return {
    origin: parseCorsOrigins(allowedOrigins),
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: false,
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  };
}

function toAnchoredPattern(entry: string): RegExp {
  const escaped = entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, HOST_CHARACTERS);
  return new RegExp(`^${escaped}$`, "i");
}
