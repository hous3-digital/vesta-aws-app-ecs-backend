import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { EnvService } from "@src/infra/env/env.service";
import { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import { UnavailableError } from "@src/shared/errors";
import { mockEnvService } from "@test/mocks/service/env.service.mock";
import { mockIssuerRepository } from "@test/mocks/repository/issuer.repository.mock";
import { mockPrismaService } from "@test/mocks/service/prisma.service.mock";
import { WalletService } from "@src/modules/wallet/application/services/wallet.service";
import type { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import type { StellarService } from "@src/modules/stellar/stellar.service";
import { Keypair } from "@stellar/stellar-sdk";

describe("WalletService organization wallet", () => {
  it("uses an issuer-only Privy identity and persists the public Stellar address", async () => {
    const stellarAddress = Keypair.random().publicKey();
    const importUser = jest.fn().mockResolvedValue({
      id: "privy_org",
      linkedAccounts: [{ id: "wallet_org", type: "wallet", chainType: "stellar", address: stellarAddress }],
    });
    const saved = {
      issuerId: "issuer_a",
      stellarAddress,
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
      issuer: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    const service = new WalletService(env, prisma, issuerRepository, stellar, new JwtService());
    (service as unknown as { client: unknown }).client = { importUser };

    const result = await service.provisionForOrganization("issuer_a");

    expect(importUser).toHaveBeenCalledWith({
      customMetadata: { issuerId: "issuer_a", walletPurpose: "organization_payout" },
      linkedAccounts: [{ type: "custom_auth", customUserId: "vesta:issuer:issuer_a" }],
      wallets: [{ chainType: "stellar" }],
    });
    expect(result.address).toBe(stellarAddress);
    expect(prisma.issuer.updateMany).toHaveBeenCalledWith({
      where: { issuerId: "issuer_a", did: null },
      data: { did: `did:pkh:stellar:testnet:${stellarAddress}` },
    });
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
      new JwtService(),
    );
    await expect(service.provisionForOrganization("issuer_a")).resolves.toEqual(
      expect.objectContaining({ address: "GEXISTING" }),
    );
  });

  it("fills a missing asset issuer on an existing wallet from the environment", async () => {
    let stored = {
      issuerId: "issuer_a",
      stellarAddress: "GEXISTING",
      network: "testnet",
      status: "ACTIVE",
      accountActivated: true,
      trustlineReady: false,
      assetCode: "BRL",
      assetIssuer: null as string | null,
      controlVerifiedAt: new Date(),
      trustlineVerifiedAt: null as Date | null,
      lastError: null as string | null,
      updatedAt: new Date(),
    };
    const update = jest.fn().mockImplementation(({ data }) => {
      stored = { ...stored, ...data };
      return Promise.resolve(stored);
    });
    const prisma = {
      organizationWallet: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(stored)),
        update,
      },
    } as unknown as PrismaService;
    const getAccountReadiness = jest.fn().mockResolvedValue({ accountActivated: true, trustlineReady: false });
    const service = new WalletService(
      {
        STELLAR_NETWORK: "Test SDF Network ; September 2015",
        STELLAR_PAYOUT_ASSET_CODE: "BRL",
        STELLAR_PAYOUT_ASSET_ISSUER: "GASSET",
      } as EnvService,
      prisma,
      {} as IIssuerRepository,
      { getAccountReadiness } as unknown as StellarService,
      new JwtService(),
    );

    await expect(service.refreshOrganizationWalletReadiness("issuer_a")).resolves.toEqual(
      expect.objectContaining({
        asset: { code: "BRL", issuer: "GASSET" },
      }),
    );
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { issuerId: "issuer_a" },
      data: { assetIssuer: "GASSET", updatedAt: expect.any(Date) },
    });
    expect(getAccountReadiness).toHaveBeenCalledWith("GEXISTING", "BRL", "GASSET");
  });
});

/** Test constants, not credentials: enough for `onModuleInit` to build the Privy client. */
const PRIVY_CLIENT_ON = {
  PRIVY_APP_ID: "privy-app-id",
  PRIVY_APP_SECRET: "test-only-privy-app-secret-with-32-plus-chars",
};

/** The custom auth paths never reach Stellar, so the gateway is an empty stub. */
const makeSut = (env: ReturnType<typeof mockEnvService>) => {
  const prisma = mockPrismaService();
  const issuerRepository = mockIssuerRepository();
  const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  const sut = new WalletService(
    env as unknown as EnvService,
    prisma as unknown as PrismaService,
    issuerRepository,
    {} as StellarService,
    new JwtService(),
  );
  return { sut, warn };
};

describe("WalletService custom auth without the signing key", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("boots with the Privy client on and warns once that custom auth is off, naming the variables", () => {
    // Arrange
    const { sut, warn } = makeSut(mockEnvService(PRIVY_CLIENT_ON));

    // Act
    sut.onModuleInit();

    // Assert
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages).toEqual([expect.stringMatching(/PRIVY_CUSTOM_AUTH_PRIVATE_KEY.*PRIVY_CUSTOM_AUTH_KEY_ID/)]);
  });

  it("warns only that Privy is off when the client itself is not configured", () => {
    // Arrange
    const { sut, warn } = makeSut(mockEnvService());

    // Act
    sut.onModuleInit();

    // Assert
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages).toHaveLength(1);
    expect(messages[0]).not.toContain("PRIVY_CUSTOM_AUTH");
  });

  it("answers PRIVY_CUSTOM_AUTH_NOT_CONFIGURED when the JWKS is requested", () => {
    // Arrange
    const { sut } = makeSut(mockEnvService());
    sut.onModuleInit();

    // Act
    const act = (): unknown => sut.getCustomAuthJwks();

    // Assert
    expect(act).toThrow(UnavailableError);
    expect(act).toThrow(expect.objectContaining({ code: "PRIVY_CUSTOM_AUTH_NOT_CONFIGURED" }));
    expect(act).not.toThrow(/PRIVY_CUSTOM_AUTH_PRIVATE_KEY/);
  });

  it("answers PRIVY_CUSTOM_AUTH_NOT_CONFIGURED when a custom auth token is requested", async () => {
    // Arrange
    const { sut } = makeSut(mockEnvService({ PRIVY_APP_ID: "privy-app-id" }));
    sut.onModuleInit();

    // Act
    const act = sut.issueCustomAuthToken("did:example:subject");

    // Assert
    await expect(act).rejects.toBeInstanceOf(UnavailableError);
    await expect(act).rejects.toMatchObject({ code: "PRIVY_CUSTOM_AUTH_NOT_CONFIGURED" });
  });

  it("answers PRIVY_NOT_CONFIGURED for the app id when PRIVY_APP_ID is absent", () => {
    // Arrange
    const { sut } = makeSut(mockEnvService());

    // Act
    const act = (): unknown => sut.getPrivyAppId();

    // Assert
    expect(act).toThrow(UnavailableError);
    expect(act).toThrow(expect.objectContaining({ code: "PRIVY_NOT_CONFIGURED" }));
  });
});
