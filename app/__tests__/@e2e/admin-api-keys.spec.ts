import request = require("supertest");
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { AdminApiFixture } from "@test/@e2e/fixtures/admin-api.fixture";
import { adminSecret } from "@test/helpers/admin-tenant.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

interface KeyListItem {
  id: string;
  keyPrefix: string;
}

describe("/admin/api-keys", () => {
  let testApp: TestApp;
  const createdKeyIds: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set("X-Admin-Secret", adminSecret());
  const challengeWith = (apiKey: string) => api().get("/public/auth/challenge").set("X-Api-Key", apiKey);

  const createKey = async (): Promise<{ id: string; key: string; keyPrefix: string }> => {
    const response = await asAdmin(api().post("/admin/api-keys")).send(
      AdminApiFixture.createApiKey(FIXTURE_ISSUER_EXTERNAL_ID),
    );
    createdKeyIds.push(response.body.data.id);
    return response.body.data;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.prisma.apiKey.deleteMany({ where: { id: { in: createdKeyIds } } });
    await testApp.close();
  });

  it("CT-VESTA-ADMIN-009 creates a key, returns it once with its prefix, and the list shows the prefix only", async () => {
    // Arrange
    const body = AdminApiFixture.createApiKey(FIXTURE_ISSUER_EXTERNAL_ID);

    // Act
    const created = await asAdmin(api().post("/admin/api-keys")).send(body);

    // Assert
    expect(created.status).toBe(201);
    createdKeyIds.push(created.body.data.id);
    expect(created.body.data.issuerId).toBe(FIXTURE_ISSUER_EXTERNAL_ID);
    expect(created.body.data.name).toBe(body.name);
    expect(created.body.data.key).toMatch(/^vesta_live_[0-9a-f]{48}$/);
    expect(created.body.data.keyPrefix).toBe(created.body.data.key.slice(0, 19));
    const list = await asAdmin(api().get("/admin/api-keys"));
    expect(list.status).toBe(200);
    const listed = (list.body.data as KeyListItem[]).find((item) => item.id === created.body.data.id);
    expect(listed?.keyPrefix).toBe(created.body.data.keyPrefix);
    expect(JSON.stringify(list.body)).not.toContain(created.body.data.key);
    expect((list.body.data as KeyListItem[]).some((item) => "key" in item || "keyHash" in item)).toBe(false);
  });

  it("CT-VESTA-SEC-004 the database keeps the hash and the prefix of a created key, never the key", async () => {
    // Arrange
    const created = await createKey();

    // Act
    const row = await testApp.prisma.apiKey.findUnique({ where: { id: created.id } });

    // Assert
    expect(row?.key).toBeNull();
    expect(row?.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.keyPrefix).toBe(created.key.slice(0, 19));
    expect(JSON.stringify(row)).not.toContain(created.key);
  });

  it("CT-VESTA-ADMIN-009 a body without name answers 400, not 401", async () => {
    // Arrange
    const body = { issuerId: FIXTURE_ISSUER_EXTERNAL_ID };

    // Act
    const response = await asAdmin(api().post("/admin/api-keys")).send(body);

    // Assert
    expect(response.status).toBe(400);
  });

  it("CT-VESTA-ADMIN-012 a body with an extra field answers 400", async () => {
    // Arrange
    const body = AdminApiFixture.createApiKey(FIXTURE_ISSUER_EXTERNAL_ID, { active: false });

    // Act
    const response = await asAdmin(api().post("/admin/api-keys")).send(body);

    // Assert
    expect(response.status).toBe(400);
  });

  it("CT-VESTA-AUTH-005 a revoked API key stops authenticating on the next request with API_KEY_INVALID", async () => {
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
    expect(afterRevoke.body.code).toBe("API_KEY_INVALID");
    const row = await testApp.prisma.apiKey.findUnique({ where: { id: created.id } });
    expect(row?.active).toBe(false);
    expect(row?.revokedAt).toBeInstanceOf(Date);
  });

  it("CT-VESTA-AUTH-005 revoking an already revoked key answers 422 API_KEY_ALREADY_REVOKED", async () => {
    // Arrange
    const created = await createKey();
    await asAdmin(api().delete(`/admin/api-keys/${created.id}`));

    // Act
    const response = await asAdmin(api().delete(`/admin/api-keys/${created.id}`));

    // Assert
    expect(response.status).toBe(422);
    expect(response.body.code).toBe("API_KEY_ALREADY_REVOKED");
  });

  it("CT-VESTA-ADMIN-009 revoking an unknown key answers 404 API_KEY_NOT_FOUND", async () => {
    // Arrange
    const unknownId = "ak_does_not_exist";

    // Act
    const response = await asAdmin(api().delete(`/admin/api-keys/${unknownId}`));

    // Assert
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("API_KEY_NOT_FOUND");
  });

  it("CT-VESTA-AUTH-010 a public route without key answers 401 API_KEY_MISSING", async () => {
    // Arrange
    const anonymous = api();

    // Act
    const response = await anonymous.get("/public/auth/challenge");

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("API_KEY_MISSING");
  });

  it("CT-VESTA-AUTH-010 a public route with an unknown key answers 401 API_KEY_INVALID", async () => {
    // Arrange
    const wrongKey = "vesta_live_not_a_key";

    // Act
    const response = await challengeWith(wrongKey);

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("API_KEY_INVALID");
  });
});
