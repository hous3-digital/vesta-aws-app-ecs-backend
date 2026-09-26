import request = require("supertest");
import { AdminApiFixture } from "@test/@e2e/fixtures/admin-api.fixture";
import { adminSecret, deleteTestTenant } from "@test/helpers/admin-tenant.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("/admin/issuers", () => {
  let testApp: TestApp;
  const createdIssuerIds: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set("X-Admin-Secret", adminSecret());
  const createIssuer = (body: Record<string, unknown>) => {
    if (typeof body.issuerId === "string") createdIssuerIds.push(body.issuerId);
    return asAdmin(api().post("/admin/issuers")).send(body);
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    for (const issuerId of createdIssuerIds) await deleteTestTenant(testApp, issuerId);
    await testApp.close();
  });

  it("CT-VESTA-ADMIN-001 creates an active issuer with the given roles and an UNREGISTERED registry status", async () => {
    // Arrange
    const body = AdminApiFixture.createIssuer({ roles: ["TECHNICAL"] });

    // Act
    const response = await createIssuer(body);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.issuerId).toBe(body.issuerId);
    expect(response.body.data.name).toBe(body.name);
    expect(response.body.data.status).toBe("active");
    expect(response.body.data.roles).toEqual(["TECHNICAL"]);
    expect(response.body.data.authorizedCredentialTypes).toEqual(["VestaKYCCredential"]);
    expect(response.body.data.registryStatus).toBe("UNREGISTERED");
  });

  it("CT-VESTA-ADMIN-001 in the local env (Privy off) the wallet provisioning ends in ERROR without an address or DID", async () => {
    // Arrange
    const body = AdminApiFixture.createIssuer();

    // Act
    const response = await createIssuer(body);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.did).toBeNull();
    expect(response.body.data.organizationWallet.issuerId).toBe(body.issuerId);
    expect(response.body.data.organizationWallet.status).toBe("ERROR");
    expect(response.body.data.organizationWallet.address).toBeNull();
    expect(response.body.data.organizationWallet.payoutReady).toBe(false);
    const wallet = await testApp.prisma.organizationWallet.findUnique({ where: { issuerId: String(body.issuerId) } });
    expect(wallet?.status).toBe("ERROR");
    expect(wallet?.stellarAddress).toBeNull();
  });

  it("CT-VESTA-ADMIN-001 POST /:issuerId/wallet retries the provisioning and answers the same wallet state", async () => {
    // Arrange
    const body = AdminApiFixture.createIssuer();
    await createIssuer(body);

    // Act
    const response = await asAdmin(api().post(`/admin/issuers/${body.issuerId}/wallet`));

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.issuerId).toBe(body.issuerId);
    expect(response.body.data.status).toBe("ERROR");
    expect(response.body.data.address).toBeNull();
  });

  it("CT-VESTA-ADMIN-002 the same issuerId twice returns 409", async () => {
    // Arrange
    const body = AdminApiFixture.createIssuer();
    await createIssuer(body);

    // Act
    const response = await asAdmin(api().post("/admin/issuers")).send(body);

    // Assert
    expect(response.status).toBe(409);
  });

  it("CT-VESTA-ADMIN-003 an empty roles list returns 400 and creates nothing", async () => {
    // Arrange
    const body = AdminApiFixture.createIssuer({ roles: [] });

    // Act
    const response = await asAdmin(api().post("/admin/issuers")).send(body);

    // Assert
    expect(response.status).toBe(400);
    const row = await testApp.prisma.issuer.findUnique({ where: { issuerId: String(body.issuerId) } });
    expect(row).toBeNull();
  });

  it("CT-VESTA-ADMIN-003 a missing roles field returns 400", async () => {
    // Arrange
    const { roles: _roles, ...body } = AdminApiFixture.createIssuer();

    // Act
    const response = await asAdmin(api().post("/admin/issuers")).send(body);

    // Assert
    expect(response.status).toBe(400);
  });

  it("CT-VESTA-ADMIN-003 an unsupported role returns 400", async () => {
    // Arrange
    const body = AdminApiFixture.createIssuer({ roles: ["OWNER"] });

    // Act
    const response = await asAdmin(api().post("/admin/issuers")).send(body);

    // Assert
    expect(response.status).toBe(400);
  });
});
