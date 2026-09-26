import request = require("supertest");
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { AdminApiFixture } from "@test/@e2e/fixtures/admin-api.fixture";
import { adminSecret } from "@test/helpers/admin-tenant.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("/admin/api-keys", () => {
  let testApp: TestApp;
  const createdKeyIds: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set("X-Admin-Secret", adminSecret());
  const challengeWith = (apiKey: string) => api().get("/public/auth/challenge").set("X-Api-Key", apiKey);

  const createKey = async (): Promise<{ id: string; key: string }> => {
    const response = await asAdmin(api().post("/admin/api-keys")).send(
      AdminApiFixture.createApiKey(FIXTURE_ISSUER_EXTERNAL_ID),
    );
    createdKeyIds.push(response.body.data.id);
    return { id: response.body.data.id, key: response.body.data.key };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.prisma.apiKey.deleteMany({ where: { id: { in: createdKeyIds } } });
    await testApp.close();
  });

  it("CT-VESTA-AUTH-005 a revoked API key stops authenticating on the next request", async () => {
    // Arrange
    const created = await createKey();
    const beforeRevoke = await challengeWith(created.key);
    expect(beforeRevoke.status).toBe(200);

    // Act
    const revoke = await asAdmin(api().delete(`/admin/api-keys/${created.id}`));

    // Assert
    expect(revoke.status).toBe(200);
    expect(revoke.body.data).toEqual({ revoked: true, id: created.id });
    const afterRevoke = await challengeWith(created.key);
    expect(afterRevoke.status).toBe(401);
    const row = await testApp.prisma.apiKey.findUnique({ where: { id: created.id } });
    expect(row?.active).toBe(false);
    expect(row?.revokedAt).toBeInstanceOf(Date);
  });

  it("CT-VESTA-AUTH-005 revoking an already revoked key is refused", async () => {
    // Arrange
    const created = await createKey();
    await asAdmin(api().delete(`/admin/api-keys/${created.id}`));

    // Act
    const response = await asAdmin(api().delete(`/admin/api-keys/${created.id}`));

    // Assert
    expect(response.status).toBe(401);
  });
});
