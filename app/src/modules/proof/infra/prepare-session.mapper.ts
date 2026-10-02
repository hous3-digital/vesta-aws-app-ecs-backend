import type { Prisma, PrepareSession as PrepareSessionRow } from "@src/infra/database/@prisma/generated/client";
import type { PrepareSession } from "@src/modules/proof/domain/prepare-session.store";

/** The payload is written by `prepare` and read back by `submit-signed` only; the cast on the `Json` column lives here. */
export class PrepareSessionMapper {
  public static toCreateInput(
    sessionHash: string,
    session: PrepareSession,
    expiresAt: Date,
  ): Prisma.PrepareSessionCreateInput {
    return {
      sessionHash,
      payload: session as unknown as Prisma.InputJsonObject,
      expiresAt,
      createdAt: new Date(),
    };
  }

  public static toDomain(row: PrepareSessionRow): PrepareSession {
    return row.payload as unknown as PrepareSession;
  }

  public static fromJson(raw: string): PrepareSession {
    return JSON.parse(raw) as PrepareSession;
  }
}
