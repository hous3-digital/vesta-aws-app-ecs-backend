import type { ChallengeService } from "@src/modules/challenge/application/services/challenge.service";

export type ChallengeServiceDouble = jest.Mocked<Pick<ChallengeService, "generate" | "store" | "consumeContext">>;

/**
 * ChallengeService is a legacy concrete class (legacy map, `challenge`), cast at the
 * constructor. `store` echoes the challenge, `generate` returns a fixed one and
 * `consumeContext` resolves null (unknown or expired challenge); specs override per case.
 */
export function mockChallengeService(): ChallengeServiceDouble {
  return {
    generate: jest.fn().mockResolvedValue({ challenge: "0".repeat(64), expiresAt: 0 }),
    store: jest.fn(async (challenge: string) => ({ challenge, expiresAt: 0 })),
    consumeContext: jest.fn().mockResolvedValue(null),
  } as unknown as ChallengeServiceDouble;
}
