import { BadRequestException } from "@nestjs/common";

export interface CursorPayload {
  ts: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined): CursorPayload | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (!parsed.ts || !parsed.id) {
      throw new Error("missing fields");
    }
    return parsed;
  } catch {
    throw new BadRequestException("Cursor invalido");
  }
}

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export function clampLimit(limit?: number): number {
  if (!limit || limit < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(limit, MAX_PAGE_LIMIT);
}
