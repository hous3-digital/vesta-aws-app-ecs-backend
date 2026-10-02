import { sha256Hex } from "@src/shared/crypto/sha256-hex";
import { randomBytes } from "node:crypto";

/** `prep_` + 32 hex, the shape the SDK already receives. */
export function newPrepareSessionId(): string {
  return `prep_${randomBytes(16).toString("hex")}`;
}

/** The id is a bearer, so both stores key by its SHA-256 and the clear id never lands anywhere. */
export function hashPrepareSessionId(sessionId: string): string {
  return sha256Hex(sessionId);
}
