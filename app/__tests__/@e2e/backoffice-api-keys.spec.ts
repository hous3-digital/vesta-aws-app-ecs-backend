import request = require("supertest");
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { BackofficeApiFixture } from "@test/@e2e/fixtures/backoffice-api.fixture";
import { createTestTenant, deleteTestTenant, TestTenant } from "@test/helpers/admin-tenant.helper";
import { loginBackoffice } from "@test/helpers/backoffice-login.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

interface KeyListItem {
  id: string;
  issuerId: string | null;
  active: boolean;
}

describe("/backoffice/api-keys", () => {
  let testApp: TestApp;
  let tokenA: string;
  let tenantB: TestTenant;
  const createdKeyIds: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const withToken = (req: request.Test, token: string) => req.set("Authorization", `Bearer ${token}`);
  const createKeyAs = async (token: string): Promise<{ id: string; key: string; issuerId: string }> => {
    const response = await withToken(api().post("/backoffice/api-keys"), token).send(
      BackofficeApiFixture.createApiKey(),
    );
    createdKeyIds.push(response.body.data.id);
    return response.body.data;
  };
  const listAs = async (token: string): Promise<KeyListItem[]> => {
    const response = await withToken(api().get("/backoffice/api-keys"), token);
    return response.body.data as KeyListItem[];
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    tokenA = await loginBackoffice(testApp);
    tenantB = await createTestTenant(testApp);
  });

  afterAll(async () => {
    await testApp.prisma.apiKey.deleteMany({ where: { id: { in: createdKeyIds } } });
    await deleteTestTenant(testApp, tenantB.issuerId);
    await testApp.close();
  });

  it("CT-VESTA-BO-007 a key created from the backoffice is bound to the logged issuer and works on /public", async () => {
    // Arrange
    const body = BackofficeApiFixture.createApiKey();

    // Act
    const response = await withToken(api().post("/backoffice/api-keys"), tokenA).send(body);

    // Assert
    expect(response.status).toBe(201);
    createdKeyIds.push(response.body.data.id);
    expect(response.body.data.issuerId).toBe(FIXTURE_ISSUER_EXTERNAL_ID);
    expect(response.body.data.name).toBe(body.name);
    expect(response.body.data.key).toMatch(/^vesta_live_/);
    const challenge = await api().get("/public/auth/challenge").set("X-Api-Key", response.body.data.key);
    expect(challenge.status).toBe(200);
  });

  it("CT-VESTA-BO-007 the list shows only the logged issuer's keys and never the secret", async () => {
    // Arrange
    const keyA = await createKeyAs(tokenA);
    const keyB = await createKeyAs(tenantB.token);

    // Act
    const listA = await listAs(tokenA);

    // Assert
    expect(listA.map((item) => item.id)).toContain(keyA.id);
    expect(listA.map((item) => item.id)).not.toContain(keyB.id);
    expect(listA.every((item) => item.issuerId === FIXTURE_ISSUER_EXTERNAL_ID)).toBe(true);
    expect(JSON.stringify(listA)).not.toContain(keyA.key);
    expect(listA.some((item) => "key" in item)).toBe(false);
  });

  it("CT-VESTA-BO-007 issuer B sees its own keys and none of issuer A's", async () => {
    // Arrange
    const keyA = await createKeyAs(tokenA);
    const keyB = await createKeyAs(tenantB.token);

    // Act
    const listB = await listAs(tenantB.token);

    // Assert
    expect(listB.map((item) => item.id)).toContain(keyB.id);
    expect(listB.map((item) => item.id)).not.toContain(keyA.id);
    expect(listB.every((item) => item.issuerId === tenantB.issuerId)).toBe(true);
  });

  it("CT-VESTA-BO-007 issuer B cannot revoke a key of issuer A", async () => {
    // Arrange
    const keyA = await createKeyAs(tokenA);

    // Act
    const response = await withToken(api().delete(`/backoffice/api-keys/${keyA.id}`), tenantB.token);

    // Assert
    expect(response.status).toBe(401);
    const row = await testApp.prisma.apiKey.findUnique({ where: { id: keyA.id } });
    expect(row?.active).toBe(true);
    const challenge = await api().get("/public/auth/challenge").set("X-Api-Key", keyA.key);
    expect(challenge.status).toBe(200);
  });

  it("CT-VESTA-BO-007 the logged issuer revokes its own key and it stops authenticating", async () => {
    // Arrange
    const keyA = await createKeyAs(tokenA);

    // Act
    const response = await withToken(api().delete(`/backoffice/api-keys/${keyA.id}`), tokenA);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ revoked: true, id: keyA.id });
    const challenge = await api().get("/public/auth/challenge").set("X-Api-Key", keyA.key);
    expect(challenge.status).toBe(401);
    const listed = (await listAs(tokenA)).find((item) => item.id === keyA.id);
    expect(listed?.active).toBe(false);
  });

  it("CT-VESTA-BO-007 without a backoffice session the routes answer 401", async () => {
    // Arrange
    const anonymous = api();

    // Act
    const response = await anonymous.get("/backoffice/api-keys");

    // Assert
    expect(response.status).toBe(401);
  });
});
