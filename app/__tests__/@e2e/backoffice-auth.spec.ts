import request = require("supertest");
import { FIXTURE_BACKOFFICE_EMAIL, FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";
import { AdminApiFixture } from "@test/@e2e/fixtures/admin-api.fixture";
import { BackofficeApiFixture } from "@test/@e2e/fixtures/backoffice-api.fixture";
import { adminSecret } from "@test/helpers/admin-tenant.helper";
import { loginBackoffice } from "@test/helpers/backoffice-login.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("/backoffice/auth", () => {
  let testApp: TestApp;
  const createdUserIds: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const login = (body: Record<string, unknown>) => api().post("/backoffice/auth/login").send(body);

  /** A user of the fixture issuer created through the admin route; deactivated by the case that needs it. */
  const createUser = async (): Promise<{ id: string; email: string; password: string }> => {
    const body = AdminApiFixture.createBackofficeUser(FIXTURE_ISSUER_EXTERNAL_ID);
    const response = await api().post("/admin/backoffice-users").set("X-Admin-Secret", adminSecret()).send(body);
    const id = response.body.data.backofficeUser.id as string;
    createdUserIds.push(id);
    return { id, email: String(body.email), password: String(body.password) };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.prisma.backofficeUser.deleteMany({ where: { id: { in: createdUserIds } } });
    await testApp.close();
  });

  it("CT-VESTA-AUTH-001 a valid login returns a bearer token and the session bound to the user's issuer", async () => {
    // Arrange
    const body = BackofficeApiFixture.login();

    // Act
    const response = await login(body);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokenType).toBe("Bearer");
    expect(response.body.data.expiresIn).toEqual(expect.any(Number));
    expect(response.body.data.user.email).toBe(FIXTURE_BACKOFFICE_EMAIL);
    expect(response.body.data.user.issuerId).toBe(FIXTURE_ISSUER_EXTERNAL_ID);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("CT-VESTA-AUTH-002 a wrong password is rejected with 401 and no token", async () => {
    // Arrange
    const body = BackofficeApiFixture.login({ password: "not-the-password" });

    // Act
    const response = await login(body);

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.data).toBeUndefined();
  });

  it("CT-VESTA-AUTH-002 an inactive user cannot log in even with the right password", async () => {
    // Arrange
    const user = await createUser();
    await testApp.prisma.backofficeUser.update({ where: { id: user.id }, data: { active: false } });

    // Act
    const response = await login(BackofficeApiFixture.login({ email: user.email, password: user.password }));

    // Assert
    expect(response.status).toBe(401);
  });

  it("CT-VESTA-AUTH-002 empty email or password is rejected with 401", async () => {
    // Arrange
    const body = BackofficeApiFixture.login({ email: "", password: "" });

    // Act
    const response = await login(body);

    // Assert
    expect(response.status).toBe(401);
  });

  it("CT-VESTA-AUTH-003 GET /me with a valid JWT returns the logged user", async () => {
    // Arrange
    const token = await loginBackoffice(testApp);

    // Act
    const response = await api().get("/backoffice/auth/me").set("Authorization", `Bearer ${token}`);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe(FIXTURE_BACKOFFICE_EMAIL);
    expect(response.body.data.user.issuerId).toBe(FIXTURE_ISSUER_EXTERNAL_ID);
  });

  it("CT-VESTA-AUTH-003 GET /me with an invalid JWT returns 401", async () => {
    // Arrange
    const authorization = "Bearer not.a.jwt";

    // Act
    const response = await api().get("/backoffice/auth/me").set("Authorization", authorization);

    // Assert
    expect(response.status).toBe(401);
  });

  it("CT-VESTA-AUTH-003 GET /me without a bearer returns 401", async () => {
    // Arrange
    const anonymous = api();

    // Act
    const response = await anonymous.get("/backoffice/auth/me");

    // Assert
    expect(response.status).toBe(401);
  });

  it("CT-VESTA-AUTH-003 a JWT of a user deactivated after login is rejected on the next request", async () => {
    // Arrange
    const user = await createUser();
    const token = await loginBackoffice(testApp, user.email, user.password);
    await testApp.prisma.backofficeUser.update({ where: { id: user.id }, data: { active: false } });

    // Act
    const response = await api().get("/backoffice/auth/me").set("Authorization", `Bearer ${token}`);

    // Assert
    expect(response.status).toBe(401);
  });
});
