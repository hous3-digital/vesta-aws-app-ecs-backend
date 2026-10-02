import { Logger } from "@nestjs/common";
import type { PrismaService } from "@src/infra/database/@prisma/prisma.service";
import type { PrepareSession } from "@src/modules/proof/domain/prepare-session.store";
import { PrepareSessionPostgresStore } from "@src/modules/proof/infra/prepare-session-postgres.store";
import { mockPrismaService, type PrepareSessionRecord } from "@test/mocks/service/prisma.service.mock";

const SESSION: PrepareSession = {
  vcHash: "vc_hash",
  proofHash: "proof_hash",
  kycLevel: "basic",
  verifierId: "verifier_example",
  issuerId: "issuer_example",
  issuerDid: null,
  userWalletAddress: null,
  expectedSource: "GDEPLOYER",
  innerTxHash: "inner_tx_hash",
  sourceAccountSignedByBackend: true,
  mock: true,
  zkProof: { protocol: "groth16", curve: "bn128", publicSignals: ["1"] },
};

const makeSut = () => {
  const prisma = mockPrismaService();
  const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  const sut = new PrepareSessionPostgresStore(prisma as unknown as PrismaService);
  return { sut, prisma, warn };
};

const storedRow = (overrides: Partial<PrepareSessionRecord> = {}): PrepareSessionRecord => ({
  sessionHash: "hash",
  payload: SESSION as unknown as Record<string, unknown>,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
  ...overrides,
});

describe("PrepareSessionPostgresStore", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("CT-VESTA-SESS-001 creates a prep_ id and stores only its hash with the expiry", async () => {
    // Arrange
    const { sut, prisma } = makeSut();

    // Act
    const sessionId = await sut.create(SESSION, 90);

    // Assert
    expect(sessionId).toMatch(/^prep_[0-9a-f]{32}$/);
    const written = prisma.prepareSession.create.mock.calls[0][0].data;
    expect(written.sessionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(written.sessionHash).not.toContain(sessionId);
    expect(written.payload).toEqual(SESSION);
    expect((written.expiresAt as Date).getTime()).toBeGreaterThan(Date.now() + 80_000);
  });

  it("CT-VESTA-SESS-001 hands the session back when the row exists and is still valid", async () => {
    // Arrange
    const { sut, prisma } = makeSut();
    prisma.prepareSession.findUnique.mockResolvedValue(storedRow());

    // Act
    const session = await sut.consume("prep_known");

    // Assert
    expect(session).toEqual(SESSION);
  });

  it("CT-VESTA-SESS-001 returns null for an unknown session", async () => {
    // Arrange
    const { sut } = makeSut();

    // Act
    const session = await sut.consume("prep_unknown");

    // Assert
    expect(session).toBeNull();
  });

  it("CT-VESTA-SESS-001 returns null when another request consumed the row first", async () => {
    // Arrange
    const { sut, prisma } = makeSut();
    prisma.prepareSession.findUnique.mockResolvedValue(storedRow());
    prisma.prepareSession.deleteMany.mockResolvedValue({ count: 0 });

    // Act
    const session = await sut.consume("prep_known");

    // Assert
    expect(session).toBeNull();
  });

  it("CT-VESTA-SESS-001 returns null for an expired session and removes its row", async () => {
    // Arrange
    const { sut, prisma } = makeSut();
    prisma.prepareSession.findUnique.mockResolvedValue(storedRow({ expiresAt: new Date(Date.now() - 1_000) }));

    // Act
    const session = await sut.consume("prep_known");

    // Assert
    expect(session).toBeNull();
    expect(prisma.prepareSession.deleteMany).toHaveBeenCalledWith({ where: { sessionHash: expect.any(String) } });
  });

  it("still returns the id when sweeping expired rows fails, logging a warning", async () => {
    // Arrange
    const { sut, prisma, warn } = makeSut();
    prisma.prepareSession.deleteMany.mockRejectedValue(new Error("connection reset"));

    // Act
    const sessionId = await sut.create(SESSION, 90);

    // Assert
    expect(sessionId).toMatch(/^prep_/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not swept"));
  });
});
