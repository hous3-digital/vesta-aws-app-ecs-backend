import request = require("supertest");
import { FIXTURE_API_KEY } from "@test/constants";
import { CredentialApiFixture } from "@test/@e2e/fixtures/credential-api.fixture";
import { createTestTenant, deleteTestTenant, TestTenant } from "@test/helpers/admin-tenant.helper";
import { loginBackoffice } from "@test/helpers/backoffice-login.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

interface CredentialListItem {
  id: string;
  vcHash: string;
  status: string;
}

describe("/backoffice/credentials", () => {
  let testApp: TestApp;
  let tokenA: string;
  let tenantB: TestTenant;
  const issuedVcHashes: string[] = [];
  /** PII sent at issuing; it must never come back through the backoffice. */
  let issued: { id: string; vcHash: string; cpf: string; fullName: string };

  const api = () => request(testApp.app.getHttpServer());
  const withToken = (req: request.Test, token: string) => req.set("Authorization", `Bearer ${token}`);

  beforeAll(async () => {
    testApp = await createTestApp();
    tokenA = await loginBackoffice(testApp);
    tenantB = await createTestTenant(testApp);

    const body = CredentialApiFixture.issue();
    const response = await api().post("/public/credential").set("X-Api-Key", FIXTURE_API_KEY).send(body);
    issuedVcHashes.push(response.body.data.vcHash);
    const row = await testApp.prisma.credential.findUniqueOrThrow({ where: { vcHash: response.body.data.vcHash } });
    issued = { id: row.id, vcHash: row.vcHash, cpf: String(body.cpf), fullName: String(body.fullName) };
  });

  afterAll(async () => {
    await testApp.prisma.credential.deleteMany({ where: { vcHash: { in: issuedVcHashes } } });
    await deleteTestTenant(testApp, tenantB.issuerId);
    await testApp.close();
  });

  it("CT-VESTA-BO-004 the list shows the issuer's credentials with vcHash and status and no PII", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/credentials"), token);

    // Assert
    expect(response.status).toBe(200);
    const items = response.body.data.items as CredentialListItem[];
    const item = items.find((candidate) => candidate.vcHash === issued.vcHash);
    expect(item).toMatchObject({ id: issued.id, vcHash: issued.vcHash, status: "ACTIVE" });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(issued.cpf);
    expect(serialized).not.toContain(issued.fullName);
    expect(serialized).not.toContain("vcDocument");
    expect(serialized).not.toContain("cpfDedupKey");
  });

  it("CT-VESTA-BO-004 the status filter returns only credentials in that status", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/credentials").query({ status: "REVOKED" }), token);

    // Assert
    expect(response.status).toBe(200);
    const items = response.body.data.items as CredentialListItem[];
    expect(items.every((item) => item.status === "REVOKED")).toBe(true);
    expect(items.map((item) => item.vcHash)).not.toContain(issued.vcHash);
  });

  it("CT-VESTA-BO-004 the detail returns the credential's public fields and no PII", async () => {
    // Arrange
    const token = tokenA;
    const target = issued;

    // Act
    const response = await withToken(api().get(`/backoffice/credentials/${target.id}`), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id: target.id, vcHash: target.vcHash, status: "ACTIVE" });
    expect(response.body.data.kycLevel).toEqual(expect.any(String));
    expect(response.body.data.subjectDid).toEqual(expect.any(String));
    expect(response.body.data.issuedAt).toEqual(expect.any(String));
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(target.cpf);
    expect(serialized).not.toContain(target.fullName);
    expect(serialized).not.toContain("vcDocument");
    expect(serialized).not.toContain("cpfDedupKey");
  });

  it("CT-VESTA-BO-004 issuer B does not list issuer A's credential", async () => {
    // Arrange
    const token = tenantB.token;

    // Act
    const response = await withToken(api().get("/backoffice/credentials"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });

  it("CT-VESTA-BO-004 issuer B reading issuer A's credential by id gets 404", async () => {
    // Arrange
    const token = tenantB.token;
    const target = issued;

    // Act
    const response = await withToken(api().get(`/backoffice/credentials/${target.id}`), token);

    // Assert
    expect(response.status).toBe(404);
  });

  it("CT-VESTA-BO-004 an unknown status filter is rejected with 400", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/credentials").query({ status: "WHATEVER" }), token);

    // Assert
    expect(response.status).toBe(400);
  });
});
