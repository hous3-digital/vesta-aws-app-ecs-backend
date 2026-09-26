import { IssuerRegistryGateway } from "@src/modules/issuer/issuer-registry.gateway";

/** Every port method as jest.fn(); specs set the return per case. */
export function mockIssuerRegistryGateway(): jest.Mocked<IssuerRegistryGateway> {
  return {
    getParticipant: jest.fn(),
    registerOrUpdate: jest.fn(),
  } as unknown as jest.Mocked<IssuerRegistryGateway>;
}
