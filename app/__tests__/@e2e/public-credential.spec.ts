import request = require("supertest");
import { FIXTURE_API_KEY } from "@test/constants";
import { CredentialApiFixture } from "@test/@e2e/fixtures/credential-api.fixture";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

describe("/public/credential", () => {
  let testApp: TestApp;
  const issuedVcHashes: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const issue = (body: Record<string, unknown>) =>
    api().post("/public/credential").set("X-Api-Key", FIXTURE_API_KEY).send(body);

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.prisma.credential.deleteMany({ where: { vcHash: { in: issuedVcHashes } } });
    await testApp.close();
  });

  it("CT-VESTA-CRED-001 issues an ACTIVE credential with kycLevel complete and returns the vcHash", async () => {
    // Arrange
    const body = CredentialApiFixture.issue({ kycLevel: "complete" });

    // Act
    const response = await issue(body);

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.vcHash).toEqual(expect.any(String));
    issuedVcHashes.push(response.body.data.vcHash);
  });

  it("CT-VESTA-CRED-003 issuing the same CPF twice returns 409 CPF_ALREADY_REGISTERED", async () => {
    // Arrange
    const body = CredentialApiFixture.issue();
    const first = await issue(body);
    issuedVcHashes.push(first.body.data.vcHash);

    // Act
    const second = await issue(body);

    // Assert
    expect(second.status).toBe(409);
    expect(JSON.stringify(second.body)).toContain("CPF_ALREADY_REGISTERED");
  });

  it("CT-VESTA-CRED-005 rejects an invalid CPF and unknown fields", async () => {
    // Act
    const badCpf = await issue(CredentialApiFixture.issue({ cpf: "11111111111" }));
    const extraField = await issue(CredentialApiFixture.issue({ unexpected: "field" }));

    // Assert
    expect(badCpf.status).toBe(400);
    expect(extraField.status).toBe(400);
  });

  it("CT-VESTA-CRED-007 the CPF is stored only as a dedup hash, never in the row", async () => {
    // Arrange
    const body = CredentialApiFixture.issue();
    const response = await issue(body);
    issuedVcHashes.push(response.body.data.vcHash);

    // Act
    const row = await testApp.prisma.credential.findUnique({ where: { vcHash: response.body.data.vcHash } });

    // Assert
    expect(row).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain(String(body.cpf));
    expect(row?.cpfDedupKey).toEqual(expect.any(String));
  });

  it("CT-VESTA-CRED-008 verify of an ACTIVE credential returns valid true with a challengeNonce", async () => {
    // Arrange
    const issued = await issue(CredentialApiFixture.issue());
    issuedVcHashes.push(issued.body.data.vcHash);

    // Act
    const response = await api()
      .post("/public/credential/verify")
      .set("X-Api-Key", FIXTURE_API_KEY)
      .send({ vcHash: issued.body.data.vcHash });

    // Assert
    expect(response.status).toBeLessThan(300);
    expect(response.body.data.valid).toBe(true);
    expect(response.body.data.challengeNonce).toEqual(expect.any(String));
  });

  it("CT-VESTA-CRED-010 revoke marks the credential REVOKED and verify then returns valid false", async () => {
    // Arrange
    const issued = await issue(CredentialApiFixture.issue());
    const vcHash = issued.body.data.vcHash;
    issuedVcHashes.push(vcHash);

    // Act
    const revoke = await api().post("/public/credential/revoke").set("X-Api-Key", FIXTURE_API_KEY).send({ vcHash });
    const verify = await api().post("/public/credential/verify").set("X-Api-Key", FIXTURE_API_KEY).send({ vcHash });

    // Assert
    expect(revoke.status).toBeLessThan(300);
    expect(revoke.body.data.status).toBe("REVOKED");
    expect(verify.body.data.valid).toBe(false);
  });
});
