import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import type { NodeEnv } from "@src/infra/env/env.schema";

/** Explicit lists, never a wildcard (`standard-security`, CORS). The write methods are what the backoffice needs (#356). */
export const CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

/** `X-Admin-Secret` stays out on purpose: admin routes are not called from a browser. */
export const CORS_ALLOWED_HEADERS = ["Authorization", "Content-Type", "X-Api-Key", "Idempotency-Key"] as const;

/** Seconds a browser may reuse a preflight answer (`Access-Control-Max-Age`), so one `OPTIONS` covers ten minutes of writes. */
export const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

/** `scheme://host[:port]`, the shape of the `Origin` header; no path, no trailing slash. */
const EXACT_ORIGIN = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/;

/** `scheme://*.domain[:port]`: the wildcard is the whole leftmost label and the domain it belongs to is named. */
const WILDCARD_ORIGIN = /^https?:\/\/\*\.[a-z0-9.-]+(?::\d{1,5})?$/;

/** What the wildcard stands for: one or more host labels. */
const WILDCARD_LABELS = "[a-z0-9.-]+";

/**
 * Parses `CORS_ALLOWED_ORIGINS`: comma-separated, each entry an exact origin or `scheme://*.domain`.
 * Entries are lowercased because the browser sends scheme and host in lowercase. A wildcard pattern
 * is anchored, so `https://*.example.com` never matches `https://app.example.com.evil.net`. An entry
 * the browser could never send, or a wildcard that is not the whole leftmost label, throws so the
 * mistake fails the boot instead of silently blocking a front.
 */
export function parseCorsOrigins(raw: string): Array<string | RegExp> {
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      if (EXACT_ORIGIN.test(entry)) return entry;
      if (WILDCARD_ORIGIN.test(entry)) return toAnchoredPattern(entry);
      throw new Error(
        `CORS_ALLOWED_ORIGINS entry "${entry}" is not an origin: expected scheme://host[:port] or scheme://*.domain[:port], no path or trailing slash`,
      );
    });
}

/**
 * The CORS policy for every deployed environment. No credentials: the backoffice sends a bearer
 * header and the SDK an API key, nothing relies on cookies.
 */
export function buildCorsOptions(allowedOrigins: string): CorsOptions {
  return policyFor(parseCorsOrigins(allowedOrigins));
}

/**
 * What `main.ts` enables. A list wins in every environment. Without one, CORS stays off in every
 * deployed environment (staging runs as `test`, so "not production" is not a safe criterion) and
 * opens the origin only on a local machine, keeping the same method and header lists.
 */
export function corsOptionsFor(input: { allowedOrigins: string; nodeEnv: NodeEnv }): CorsOptions | null {
  if (input.allowedOrigins.trim().length > 0) return buildCorsOptions(input.allowedOrigins);
  return input.nodeEnv === "local" ? policyFor(true) : null;
}

function policyFor(origin: CorsOptions["origin"]): CorsOptions {
  return {
    origin,
    methods: [...CORS_ALLOWED_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: false,
    maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
  };
}

function toAnchoredPattern(entry: string): RegExp {
  const escaped = entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace("*", WILDCARD_LABELS);
  return new RegExp(`^${escaped}$`);
}
