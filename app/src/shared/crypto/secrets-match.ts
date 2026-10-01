import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time equality for secrets presented by a caller (admin header, API key hash).
 * Lengths are compared first because timingSafeEqual requires buffers of the same size;
 * a length mismatch is a plain mismatch, never an exception.
 */
export function secretsMatch(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  if (expectedBytes.length !== providedBytes.length) return false;
  return timingSafeEqual(expectedBytes, providedBytes);
}
