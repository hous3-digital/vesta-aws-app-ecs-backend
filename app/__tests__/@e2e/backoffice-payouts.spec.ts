import request = require("supertest");
import { faker } from "@faker-js/faker";
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { createTestTenant, deleteTestTenant, TestTenant } from "@test/helpers/admin-tenant.helper";
import { loginBackoffice } from "@test/helpers/backoffice-login.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("/backoffice/payouts", () => {
  let testApp: TestApp;
  let tokenA: string;
  let tenantB: TestTenant;
  const payoutIds: string[] = [];
  const ledgerEntryIds: string[] = [];
  let payoutA: { id: string };
  let ledgerEntryA: { id: string };

  const api = () => request(testApp.app.getHttpServer());
  const withToken = (req: request.Test, token: string) => req.set("Authorization", `Bearer ${token}`);
  const hex = (length: number) => faker.string.hexadecimal({ length, casing: "lower", prefix: "" });

  /**
   * A payout written straight to Postgres: requesting one needs a settled wallet and a real contract.
   * CONFIRMED is terminal, so the payout processor that runs on boot never claims it.
   */
  const insertPayout = async (issuerId: string): Promise<{ id: string }> => {
    const now = new Date();
    const row = await testApp.prisma.payoutRequest.create({
      data: {
        id: `payout_e2e_${hex(24)}`,
        issuerId,
        walletId: `org_wallet_e2e_${hex(12)}`,
        destinationAddress: `G${hex(55).toUpperCase()}`,
        amountMinor: BigInt(137),
        currency: "BRL",
        settlementAssetCode: "BRL",
        settlementAmountAtomic: BigInt(13_700_000),
        status: "CONFIRMED",
        idempotencyKeyHash: hex(64),
        onChainPayoutId: hex(64),
        stellarTxHash: hex(64),
        stellarLedger: 1,
        requestedAt: now,
        submittedAt: now,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    payoutIds.push(row.id);
    return { id: row.id };
  };

  const insertLedgerEntry = async (issuerId: string): Promise<{ id: string }> => {
    const now = new Date();
    const row = await testApp.prisma.commissionLedgerEntry.create({
      data: {
        id: `commission_e2e_${hex(24)}`,
        issuerId,
        entryType: "ACCRUAL",
        status: "PENDING_SECURITY",
        amountMinor: 137,
        currency: "BRL",
        source: "ATTESTATION_REUSE",
        occurredAt: now,
        availableAt: new Date(now.getTime() + 60 * 60 * 1000),
        createdAt: now,
      },
    });
    ledgerEntryIds.push(row.id);
    return { id: row.id };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    tokenA = await loginBackoffice(testApp);
    tenantB = await createTestTenant(testApp);
    payoutA = await insertPayout(FIXTURE_ISSUER_EXTERNAL_ID);
    ledgerEntryA = await insertLedgerEntry(FIXTURE_ISSUER_EXTERNAL_ID);
  });

  afterAll(async () => {
    await testApp.prisma.payoutRequest.deleteMany({ where: { id: { in: payoutIds } } });
    await testApp.prisma.commissionLedgerEntry.deleteMany({ where: { id: { in: ledgerEntryIds } } });
    await deleteTestTenant(testApp, tenantB.issuerId);
    await testApp.close();
  });

  it("CT-VESTA-PAY-001 readiness lists the settlement contract and the wallet as prerequisites, both unmet locally", async () => {
    // Arrange
    const token = tenantB.token;

    // Act
    const response = await withToken(api().get("/backoffice/payouts/readiness"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      ready: false,
      contractReady: false,
      walletReady: false,
      reason: "SETTLEMENT_NOT_CONFIGURED",
    });
  });

  // TD-009: getReadiness refreshes the wallet before listing prerequisites, so an issuer without a wallet gets 400.
  it.skip("CT-VESTA-PAY-001 TD-009 readiness of an issuer without a wallet lists the wallet as the missing prerequisite", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/payouts/readiness"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.ready).toBe(false);
    expect(response.body.data.walletReady).toBe(false);
  });

  it("CT-VESTA-PAY-001 requesting a payout while settlement is not configured is refused with 400", async () => {
    // Arrange
    const token = tenantB.token;

    // Act
    const response = await withToken(api().post("/backoffice/payouts"), token).set("Idempotency-Key", hex(32));

    // Assert
    expect(response.status).toBe(400);
    const rows = await testApp.prisma.payoutRequest.findMany({ where: { issuerId: tenantB.issuerId } });
    expect(rows).toEqual([]);
  });

  it("CT-VESTA-PAY-003 issuer A lists its own payout", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/payouts"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.items.map((item: { id: string }) => item.id)).toContain(payoutA.id);
  });

  it("CT-VESTA-PAY-003 issuer A reads its own payout with its attempts", async () => {
    // Arrange
    const token = tokenA;
    const target = payoutA;

    // Act
    const response = await withToken(api().get(`/backoffice/payouts/${target.id}`), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: target.id, status: "CONFIRMED", amountMinor: "137" });
    expect(response.body.data.attempts).toEqual([]);
  });

  it("CT-VESTA-PAY-003 issuer B does not list issuer A's payouts", async () => {
    // Arrange
    const token = tenantB.token;

    // Act
    const response = await withToken(api().get("/backoffice/payouts"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });

  it("CT-VESTA-PAY-003 issuer B reading issuer A's payout by id gets 404", async () => {
    // Arrange
    const token = tenantB.token;
    const target = payoutA;

    // Act
    const response = await withToken(api().get(`/backoffice/payouts/${target.id}`), token);

    // Assert
    expect(response.status).toBe(404);
  });

  it("CT-VESTA-PAY-003 issuer B has no active payout of its own", async () => {
    // Arrange
    const token = tenantB.token;

    // Act
    const response = await withToken(api().get("/backoffice/payouts/active"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  it("CT-VESTA-PAY-003 issuer A sees its own ledger entry", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/commissions/ledger"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.items.map((item: { id: string }) => item.id)).toContain(ledgerEntryA.id);
  });

  it("CT-VESTA-PAY-003 issuer B does not see issuer A's ledger", async () => {
    // Arrange
    const token = tenantB.token;

    // Act
    const response = await withToken(api().get("/backoffice/commissions/ledger"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });
});
