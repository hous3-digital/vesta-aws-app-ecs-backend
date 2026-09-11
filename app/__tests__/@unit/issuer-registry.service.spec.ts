import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import {
  IssuerRegistryGateway,
  IssuerRegistryUnavailableError,
  type RegistryParticipant,
} from "@src/modules/issuer/issuer-registry.gateway";
import { IssuerRegistryService } from "@src/modules/issuer/issuer-registry.service";

const did = "did:pkh:stellar:testnet:GISSUER";
const participant: RegistryParticipant = {
  did,
  roles: ["TECHNICAL", "COMMERCIAL"],
  payoutAddress: "GPAYOUT",
  commissionTerms: [
    { role: "TECHNICAL", shareBps: 6_000 },
    { role: "COMMERCIAL", shareBps: 4_000 },
  ],
  authorizedCredentialTypes: ["VestaKYCCredential"],
  status: "ACTIVE",
  registeredAt: 100,
  updatedAt: 200,
};

describe("IssuerRegistryService", () => {
  function setup(gatewayResult?: unknown) {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      issuer: {
        findUnique: jest.fn().mockResolvedValue({
          issuerId: "issuer_a",
          did,
          roles: ["TECHNICAL", "COMMERCIAL"],
          authorizedCredentialTypes: ["VestaKYCCredential"],
        }),
        update,
      },
      organizationWallet: {
        findUnique: jest.fn().mockResolvedValue({ status: "ACTIVE", stellarAddress: "GPAYOUT" }),
      },
    } as unknown as PrismaService;
    const registerOrUpdate = jest.fn().mockResolvedValue(
      gatewayResult ?? {
        operation: "REGISTERED",
        participant,
        txHash: "registry_tx",
        ledger: 321,
      },
    );
    const gateway = { registerOrUpdate } as unknown as IssuerRegistryGateway;
    return { service: new IssuerRegistryService(prisma, gateway), registerOrUpdate, update };
  }

  it("derives public registry data from the issuer and stores only confirmed transaction evidence", async () => {
    const { service, registerOrUpdate, update } = setup();

    const result = await service.registerOrUpdate("issuer_a", participant.commissionTerms);

    expect(registerOrUpdate).toHaveBeenCalledWith({
      did,
      roles: ["TECHNICAL", "COMMERCIAL"],
      payoutAddress: "GPAYOUT",
      commissionTerms: participant.commissionTerms,
      authorizedCredentialTypes: ["VestaKYCCredential"],
    });
    expect(update).toHaveBeenCalledWith({
      where: { issuerId: "issuer_a" },
      data: {
        registryStatus: "REGISTERED",
        registryTransactionHash: "registry_tx",
        registryLedger: 321,
        registryConfirmedAt: expect.any(Date),
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        registry: expect.objectContaining({ did, active: true, payoutAddress: "GPAYOUT" }),
        transaction: expect.objectContaining({ hash: "registry_tx", ledger: 321 }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("issuer_a");
  });

  it("does not persist confirmation when Soroban fails", async () => {
    const { service, registerOrUpdate, update } = setup();
    registerOrUpdate.mockRejectedValue(
      new IssuerRegistryUnavailableError("REGISTRY_PREFLIGHT_FAILED", "Preflight falhou"),
    );

    await expect(service.registerOrUpdate("issuer_a", participant.commissionTerms)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects fractional, missing or mismatched commission terms before Soroban", async () => {
    const { service, registerOrUpdate } = setup();

    await expect(service.registerOrUpdate("issuer_a", [{ role: "TECHNICAL", shareBps: 12.5 }])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(registerOrUpdate).not.toHaveBeenCalled();
  });
});
