import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

type NodeEnv = "local" | "test" | "development" | "production";

/** Explicit lists, never a wildcard (`standard-security`, CORS). The write methods are what the backoffice needs (#356). */
export const CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

/** `X-Admin-Secret` stays out on purpose: admin routes are not called from a browser. */
export const CORS_ALLOWED_HEADERS = ["Authorization", "Content-Type", "X-Api-Key", "Idempotency-Key"] as const;

/** Seconds a browser may reuse a preflight answer (`Access-Control-Max-Age`), so one `OPTIONS` covers ten minutes of writes. */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

const HOST_CHARACTERS = "[a-z0-9.-]+";

/** Scheme, host and optional port, the shape a browser puts in the `Origin` header. No path, no trailing slash. */
const ORIGIN_ENTRY = /^https?:\/\/[a-z0-9.*-]+(?::\d{1,5})?$/i;

/** A wildcard standing for the whole host (`https://*`, `https://*:3000`) would allow every site. */
const WILDCARD_WHOLE_HOST = /^https?:\/\/\*(?::\d{1,5})?$/i;

/**
 * Parses `CORS_ALLOWED_ORIGINS`: comma-separated, each entry an exact origin or a wildcard pattern.
 * A wildcard matches host characters only and the pattern is anchored, so `https://*.example.com`
 * never matches `https://app.example.com.evil.net`. An entry a browser could never send (no scheme,
 * a path, a trailing slash) or a wildcard covering the whole host throws, so the mistake fails the
 * boot instead of silently blocking a front.
 */
export function parseCorsOrigins(raw: string): Array<string | RegExp> {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      assertOriginEntry(entry);
      return entry.includes("*") ? toAnchoredPattern(entry) : entry;
    });
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

/**
 * What `main.ts` enables. A list wins in every environment. Without one, CORS stays off in every
 * deployed environment (staging runs as `test`, so "not production" is not a safe criterion) and
 * opens the origin only on a local machine, keeping the same method and header lists.
 */
export function corsOptionsFor(input: { allowedOrigins: string; nodeEnv: NodeEnv }): CorsOptions | null {
  if (input.allowedOrigins.trim().length > 0) return buildCorsOptions(input.allowedOrigins);
  if (input.nodeEnv !== "local") return null;
  return {
    origin: true,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: false,
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  };
}

function assertOriginEntry(entry: string): void {
  if (!ORIGIN_ENTRY.test(entry)) {
    throw new Error(
      `CORS_ALLOWED_ORIGINS entry "${entry}" is not an origin: expected scheme://host[:port] with no path or trailing slash`,
    );
  }
  if (WILDCARD_WHOLE_HOST.test(entry)) {
    throw new Error(
      `CORS_ALLOWED_ORIGINS entry "${entry}" would allow every host; name the domain the wildcard belongs to`,
    );
  }
}

function toAnchoredPattern(entry: string): RegExp {
  const escaped = entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, HOST_CHARACTERS);
  return new RegExp(`^${escaped}$`, "i");
}
