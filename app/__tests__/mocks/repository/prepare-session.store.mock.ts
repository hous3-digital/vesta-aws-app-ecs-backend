import type { IPrepareSessionStore } from "@src/modules/proof/domain/prepare-session.store";

/** `create` hands back a fixed id; `consume` resolves null until the spec sets a session. */
export function mockPrepareSessionStore(): jest.Mocked<IPrepareSessionStore> {
  return {
    create: jest.fn().mockResolvedValue(`prep_${"0".repeat(32)}`),
    consume: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<IPrepareSessionStore>;
}
