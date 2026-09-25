import request = require("supertest");
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { createTestTenant, deleteTestTenant, TestTenant } from "@test/helpers/admin-tenant.helper";
import { loginBackoffice } from "@test/helpers/backoffice-login.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("/backoffice/profile", () => {
  let testApp: TestApp;
  let tokenA: string;
  let tenantB: TestTenant;

  const api = () => request(testApp.app.getHttpServer());
  const withToken = (req: request.Test, token: string) => req.set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    testApp = await createTestApp();
    tokenA = await loginBackoffice(testApp);
    tenantB = await createTestTenant(testApp);
  });

  afterAll(async () => {
    await deleteTestTenant(testApp, tenantB.issuerId);
    await testApp.close();
  });

  it("CT-VESTA-BO-001 the profile is the issuer of the JWT", async () => {
    // Act
    const response = await withToken(api().get("/backoffice/profile"), tokenA);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ issuerId: FIXTURE_ISSUER_EXTERNAL_ID, name: "Banco Local Dev" });
  });

  it("CT-VESTA-BO-001 issuer B's profile is issuer B, never the fixture issuer", async () => {
    // Arrange
    const issuer = await testApp.prisma.issuer.findUnique({ where: { issuerId: tenantB.issuerId } });

    // Act
    const response = await withToken(api().get("/backoffice/profile"), tenantB.token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ issuerId: tenantB.issuerId, name: issuer?.name });
  });

  it("CT-VESTA-BO-001 the wallet is null for an issuer that was never provisioned", async () => {
    // Arrange
    const row = await testApp.prisma.organizationWallet.findUnique({ where: { issuerId: FIXTURE_ISSUER_EXTERNAL_ID } });
    expect(row).toBeNull();

    // Act
    const response = await withToken(api().get("/backoffice/profile/wallet"), tokenA);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  it("CT-VESTA-BO-001 the wallet route answers the logged issuer's own wallet state", async () => {
    // Act
    const response = await withToken(api().get("/backoffice/profile/wallet"), tenantB.token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.issuerId).toBe(tenantB.issuerId);
    expect(response.body.data.status).toBe("ERROR");
    expect(response.body.data.address).toBeNull();
    expect(response.body.data.payoutReady).toBe(false);
    expect(response.body.data.asset.code).toEqual(expect.any(String));
  });

  it("CT-VESTA-BO-001 without a backoffice session the profile answers 401", async () => {
    // Act
    const response = await api().get("/backoffice/profile");

    // Assert
    expect(response.status).toBe(401);
  });
});
