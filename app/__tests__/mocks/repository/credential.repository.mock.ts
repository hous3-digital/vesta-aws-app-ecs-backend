import type { Credential } from "@src/modules/credential/domain/credential.entity";
import type { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";

/** Every port method as jest.fn(): reads resolve null, writes echo the entity. Specs override per case. */
export function mockCredentialRepository(): jest.Mocked<ICredentialRepository> {
  return {
    findByVcHash: jest.fn().mockResolvedValue(null),
    findByCpfDedupKey: jest.fn().mockResolvedValue(null),
    findByIdOrThrow: jest.fn().mockRejectedValue(new Error("findByIdOrThrow has no default; set it in the spec")),
    saveOrThrow: jest.fn(async (credential: Credential) => credential),
    updateOrThrow: jest.fn(async (credential: Credential) => credential),
    upsertByVcHash: jest.fn(async (credential: Credential) => credential),
    deleteById: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ICredentialRepository>;
}
