import type { ApiKey } from "@src/modules/api-key/domain/api-key.entity";
import type { IApiKeyRepository } from "@src/modules/api-key/domain/api-key.repository";

/** Every port method as jest.fn(): reads resolve null, writes echo the entity. Specs override per case. */
export function mockApiKeyRepository(): jest.Mocked<IApiKeyRepository> {
  return {
    findByHash: jest.fn().mockResolvedValue(null),
    findByIdOrThrow: jest.fn().mockRejectedValue(new Error("findByIdOrThrow has no default; set it in the spec")),
    findByIdForIssuerOrThrow: jest
      .fn()
      .mockRejectedValue(new Error("findByIdForIssuerOrThrow has no default; set it in the spec")),
    saveOrThrow: jest.fn(async (apiKey: ApiKey) => apiKey),
    updateOrThrow: jest.fn(async (apiKey: ApiKey) => apiKey),
  } as unknown as jest.Mocked<IApiKeyRepository>;
}
