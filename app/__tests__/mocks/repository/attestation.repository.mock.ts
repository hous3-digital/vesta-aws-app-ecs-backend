import type { Attestation } from "@src/modules/proof/domain/attestation.entity";
import type { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";

/** Every port method as jest.fn(): reads resolve empty, the write echoes the entity. */
export function mockAttestationRepository(): jest.Mocked<IAttestationRepository> {
  return {
    saveOrThrow: jest.fn(async (attestation: Attestation) => attestation),
    findById: jest.fn().mockResolvedValue(null),
    findByVcHash: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<IAttestationRepository>;
}
