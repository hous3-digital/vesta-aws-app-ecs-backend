import { WalletService } from "@src/modules/wallet/wallet.service";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import type { EnvService } from "@src/infra/env/env.service";
import type { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import type { StellarService } from "@src/modules/stellar/stellar.service";

describe("WalletService organization wallet", () => {
  it("uses an issuer-only Privy identity and persists the public Stellar address", async () => {
    const importUser = jest.fn().mockResolvedValue({
      id: "privy_org",
      linkedAccounts: [{ id: "wallet_org", type: "wallet", chainType: "stellar", address: "GORGANIZATION" }],
    });
    const saved = {
      issuerId: "issuer_a",
      stellarAddress: "GORGANIZATION",
      network: "testnet",
      status: "ACTIVE",
      accountActivated: true,
      trustlineReady: false,
      assetCode: "BRL",
      assetIssuer: "GASSET",
      controlVerifiedAt: null,
      trustlineVerifiedAt: null,
      lastError: null,
      updatedAt: new Date(),
    };
    const prisma = {
      organizationWallet: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue(saved),
      },
    } as unknown as PrismaService;
    const env = {
      PRIVY_APP_ID: "app",
      PRIVY_APP_SECRET: "secret",
      STELLAR_NETWORK: "Test SDF Network ; September 2015",
      STELLAR_PAYOUT_ASSET_CODE: "BRL",
      STELLAR_PAYOUT_ASSET_ISSUER: "GASSET",
    } as EnvService;
    const issuerRepository = {
      findByExternalId: jest.fn().mockResolvedValue({ externalId: "issuer_a" }),
    } as unknown as IIssuerRepository;
    const stellar = {
      ensureAccountExists: jest.fn().mockResolvedValue(undefined),
      getAccountReadiness: jest.fn().mockResolvedValue({ accountActivated: true, trustlineReady: false }),
    } as unknown as StellarService;
    const service = new WalletService(env, prisma, issuerRepository, stellar);
    (service as unknown as { client: unknown }).client = { importUser };

    const result = await service.provisionForOrganization("issuer_a");

    expect(importUser).toHaveBeenCalledWith({
      customMetadata: { issuerId: "issuer_a", walletPurpose: "organization_payout" },
      linkedAccounts: [{ type: "custom_auth", customUserId: "vesta:issuer:issuer_a" }],
      wallets: [{ chainType: "stellar" }],
    });
    expect(result.address).toBe("GORGANIZATION");
    expect(JSON.stringify(importUser.mock.calls)).not.toMatch(/cpf|subjectDid/i);
  });

  it("returns an already active wallet without creating another Privy user", async () => {
    const existing = {
      issuerId: "issuer_a",
      stellarAddress: "GEXISTING",
      network: "testnet",
      status: "ACTIVE",
      accountActivated: true,
      trustlineReady: true,
      assetCode: "XLM",
      assetIssuer: null,
      controlVerifiedAt: new Date(),
      trustlineVerifiedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    };
    const prisma = {
      organizationWallet: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const service = new WalletService(
      { STELLAR_NETWORK: "Test SDF Network ; September 2015" } as EnvService,
      prisma,
      { findByExternalId: jest.fn().mockResolvedValue({ externalId: "issuer_a" }) } as unknown as IIssuerRepository,
      {
        getAccountReadiness: jest.fn().mockResolvedValue({ accountActivated: true, trustlineReady: true }),
      } as unknown as StellarService,
    );
    await expect(service.provisionForOrganization("issuer_a")).resolves.toEqual(
      expect.objectContaining({ address: "GEXISTING" }),
    );
  });
});
