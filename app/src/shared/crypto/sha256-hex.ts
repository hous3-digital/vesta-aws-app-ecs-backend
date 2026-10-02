import { createHash } from "node:crypto";

/** SHA-256 as lowercase hex, the form every `*_hash` column and bearer key uses. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
