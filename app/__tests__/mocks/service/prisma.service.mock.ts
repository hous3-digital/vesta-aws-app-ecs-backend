import type { PasskeyRecord } from "@test/mocks/model/passkey.model";

/** Hand-typed double of the Prisma delegates a legacy service or a store reads; grows one model at a time. */
export interface PrismaServiceDouble {
  passkeyCredential: {
    create: jest.MockedFunction<(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>>;
    findFirst: jest.MockedFunction<(args: { where: Record<string, unknown> }) => Promise<PasskeyRecord | null>>;
    findUnique: jest.MockedFunction<(args: { where: Record<string, unknown> }) => Promise<PasskeyRecord | null>>;
    updateMany: jest.MockedFunction<
      (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>
    >;
  };
  prepareSession: {
    create: jest.MockedFunction<(args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>>;
    findUnique: jest.MockedFunction<(args: { where: Record<string, unknown> }) => Promise<PrepareSessionRecord | null>>;
    deleteMany: jest.MockedFunction<(args: { where: Record<string, unknown> }) => Promise<{ count: number }>>;
  };
}

/** The row `PrepareSessionPostgresStore` reads back; `payload` is whatever `prepare` stored. */
export interface PrepareSessionRecord {
  sessionHash: string;
  payload: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * For the legacy services that query Prisma directly instead of a repository (legacy
 * map, `challenge`), cast to `PrismaService` at the constructor. Reads resolve null,
 * `create` echoes its data and `updateMany` reports one row; a spec overrides what its
 * case needs. Disappears with the repositories.
 */
export function mockPrismaService(): PrismaServiceDouble {
  return {
    passkeyCredential: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    prepareSession: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
      findUnique: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}
