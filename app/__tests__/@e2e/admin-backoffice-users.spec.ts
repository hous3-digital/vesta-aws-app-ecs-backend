import request = require("supertest");
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { AdminApiFixture } from "@test/@e2e/fixtures/admin-api.fixture";
import { adminSecret } from "@test/helpers/admin-tenant.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("/admin/backoffice-users", () => {
  let testApp: TestApp;
  const createdEmails: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const createUser = (body: Record<string, unknown>) => {
    if (typeof body.email === "string") createdEmails.push(body.email.toLowerCase());
    return api().post("/admin/backoffice-users").set("X-Admin-Secret", adminSecret()).send(body);
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.prisma.backofficeUser.deleteMany({ where: { email: { in: createdEmails } } });
    await testApp.close();
  });

  it("CT-VESTA-ADMIN-007 creates the user and returns a generated temporary password when none is given", async () => {
    // Arrange
    const { password: _password, ...body } = AdminApiFixture.createBackofficeUser(FIXTURE_ISSUER_EXTERNAL_ID);

    // Act
    const response = await createUser(body);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.backofficeUser.email).toBe(body.email);
    expect(response.body.data.backofficeUser.issuerId).toBe(FIXTURE_ISSUER_EXTERNAL_ID);
    expect(response.body.data.temporaryPassword).toEqual(expect.any(String));
    expect(response.body.data.temporaryPassword.length).toBeGreaterThanOrEqual(16);
  });

  it("CT-VESTA-ADMIN-007 the temporary password is returned once: the row keeps only a bcrypt hash", async () => {
    // Arrange
    const body = AdminApiFixture.createBackofficeUser(FIXTURE_ISSUER_EXTERNAL_ID);
    const created = await createUser(body);

    // Act
    const row = await testApp.prisma.backofficeUser.findUnique({ where: { email: String(body.email) } });

    // Assert
    expect(created.body.data.temporaryPassword).toBe(body.password);
    expect(row?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row?.passwordHash).not.toBe(body.password);
    expect(JSON.stringify(created.body.data.backofficeUser)).not.toContain("passwordHash");
  });

  it("CT-VESTA-ADMIN-007 the temporary password logs the new user in", async () => {
    // Arrange
    const body = AdminApiFixture.createBackofficeUser(FIXTURE_ISSUER_EXTERNAL_ID);
    const created = await createUser(body);

    // Act
    const login = await api()
      .post("/backoffice/auth/login")
      .send({ email: body.email, password: created.body.data.temporaryPassword });

    // Assert
    expect(login.status).toBe(201);
    expect(login.body.data.user.issuerId).toBe(FIXTURE_ISSUER_EXTERNAL_ID);
  });

  it("CT-VESTA-ADMIN-007 an unknown issuer returns 404", async () => {
    // Arrange
    const body = AdminApiFixture.createBackofficeUser(AdminApiFixture.issuerId());

    // Act
    const response = await createUser(body);

    // Assert
    expect(response.status).toBe(404);
  });

  it("CT-VESTA-ADMIN-008 the same email twice returns 409", async () => {
    // Arrange
    const body = AdminApiFixture.createBackofficeUser(FIXTURE_ISSUER_EXTERNAL_ID);
    await createUser(body);

    // Act
    const response = await createUser(body);

    // Assert
    expect(response.status).toBe(409);
  });

  it("CT-VESTA-ADMIN-008 the email is matched case-insensitively", async () => {
    // Arrange
    const body = AdminApiFixture.createBackofficeUser(FIXTURE_ISSUER_EXTERNAL_ID);
    await createUser(body);

    // Act
    const response = await createUser({ ...body, email: String(body.email).toUpperCase() });

    // Assert
    expect(response.status).toBe(409);
  });
});
