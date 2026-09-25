import type { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";

/** Every port method as jest.fn(); reads resolve null until the spec sets an issuer. */
export function mockIssuerRepository(): jest.Mocked<IIssuerRepository> {
  return {
    findByExternalId: jest.fn().mockResolvedValue(null),
    findByDid: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<IIssuerRepository>;
}
