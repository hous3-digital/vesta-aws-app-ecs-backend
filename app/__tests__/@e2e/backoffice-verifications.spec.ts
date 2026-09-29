import request = require("supertest");
import { faker } from "@faker-js/faker";
import { FIXTURE_API_KEY, FIXTURE_ISSUER_EXTERNAL_ID, FIXTURE_VERIFIER_ID } from "@test/constants";
import { CredentialApiFixture } from "@test/@e2e/fixtures/credential-api.fixture";
import { createTestTenant, deleteTestTenant, TestTenant } from "@test/helpers/admin-tenant.helper";
import { loginBackoffice } from "@test/helpers/backoffice-login.helper";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

interface VerificationListItem {
  id: string;
  status: string;
  origin: string;
  verifierId: string;
  verificationHash: string;
  amount: number;
}

describe("/backoffice/verifications", () => {
  let testApp: TestApp;
  let tokenA: string;
  let tenantB: TestTenant;
  const issuedVcHashes: string[] = [];
  const attestationIds: string[] = [];
  let attestation: { id: string; vcHash: string; proofHash: string; sorobanTxHash: string };

  const api = () => request(testApp.app.getHttpServer());
  const withToken = (req: request.Test, token: string) => req.set("Authorization", `Bearer ${token}`);
  const hex = (length: number) => faker.string.hexadecimal({ length, casing: "lower", prefix: "" });

  /**
   * An attestation of the fixture issuer, written straight to Postgres: producing one through
   * /public/proof needs a real Groth16 proof, which public-proof.spec.ts already covers.
   */
  const insertAttestation = async (vcHash: string): Promise<typeof attestation> => {
    const sorobanTxHash = hex(64);
    const row = await testApp.prisma.attestation.create({
      data: {
        id: `att_e2e_${hex(24)}`,
        vcHash,
        proofHash: hex(64),
        verifierId: FIXTURE_VERIFIER_ID,
        kycLevel: "complete",
        sorobanTxHash,
        sorobanLedger: 1,
        onChainResult: true,
        issuerId: FIXTURE_ISSUER_EXTERNAL_ID,
        createdAt: new Date(),
      },
    });
    attestationIds.push(row.id);
    return { id: row.id, vcHash: row.vcHash, proofHash: row.proofHash, sorobanTxHash };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    tokenA = await loginBackoffice(testApp);
    tenantB = await createTestTenant(testApp);

    const issue = await api()
      .post("/public/credential")
      .set("X-Api-Key", FIXTURE_API_KEY)
      .send(CredentialApiFixture.issue());
    issuedVcHashes.push(issue.body.data.vcHash);
    attestation = await insertAttestation(issue.body.data.vcHash);
  });

  afterAll(async () => {
    await testApp.prisma.attestation.deleteMany({ where: { id: { in: attestationIds } } });
    await testApp.prisma.credential.deleteMany({ where: { vcHash: { in: issuedVcHashes } } });
    await deleteTestTenant(testApp, tenantB.issuerId);
    await testApp.close();
  });

  it("CT-VESTA-BO-005 the list shows the issuer's verifications with the verifier name and the commission", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/verifications"), token);

    // Assert
    expect(response.status).toBe(200);
    const items = response.body.data.items as VerificationListItem[];
    const item = items.find((candidate) => candidate.id === attestation.id);
    expect(item).toMatchObject({
      id: attestation.id,
      status: "completed",
      verifierId: FIXTURE_VERIFIER_ID,
      origin: "Verifier Local",
      verificationHash: attestation.proofHash,
    });
    expect(item?.amount).toBeGreaterThan(0);
  });

  it("CT-VESTA-BO-005 the list filters by verifierId and by status", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(
      api().get("/backoffice/verifications").query({ verifierId: FIXTURE_VERIFIER_ID, status: "failed" }),
      token,
    );

    // Assert
    expect(response.status).toBe(200);
    const items = response.body.data.items as VerificationListItem[];
    expect(items.every((item) => item.status === "failed" && item.verifierId === FIXTURE_VERIFIER_ID)).toBe(true);
    expect(items.map((item) => item.id)).not.toContain(attestation.id);
  });

  it("CT-VESTA-BO-005 the detail returns the verification with its hashes and transaction", async () => {
    // Arrange
    const token = tokenA;
    const target = attestation;

    // Act
    const response = await withToken(api().get(`/backoffice/verifications/${target.id}`), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: target.id,
      vcHash: target.vcHash,
      verificationHash: target.proofHash,
      txHash: target.sorobanTxHash,
      status: "completed",
      verifierId: FIXTURE_VERIFIER_ID,
    });
    expect(response.body.data.date).toEqual(expect.any(String));
  });

  it("CT-VESTA-BO-005 the CSV export is served as an attachment with a header row and the verification", async () => {
    // Arrange
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Act
    const response = await withToken(
      api().get("/backoffice/verifications/export").query({ period: "custom", from, to }),
      tokenA,
    );

    // Assert
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toMatch(/^attachment; filename="verifications-.*\.csv"$/);
    const lines = response.text.split("\n");
    expect(lines[0]).toBe("id,date,verifierId,verifierName,vcHash,verificationHash,status,txHash,ledger,amountBRL");
    const line = lines.find((candidate) => candidate.startsWith(`${attestation.id},`));
    expect(line).toContain(
      `,${FIXTURE_VERIFIER_ID},Verifier Local,${attestation.vcHash},${attestation.proofHash},completed,`,
    );
  });

  it("CT-VESTA-BO-005 the CSV export without a period is rejected with 400", async () => {
    // Arrange
    const token = tokenA;

    // Act
    const response = await withToken(api().get("/backoffice/verifications/export"), token);

    // Assert
    expect(response.status).toBe(400);
  });

  it("CT-VESTA-BO-005 issuer B does not list issuer A's verification", async () => {
    // Arrange
    const token = tenantB.token;

    // Act
    const response = await withToken(api().get("/backoffice/verifications"), token);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.items).toEqual([]);
  });

  it("CT-VESTA-BO-005 issuer B reading issuer A's verification by id gets 404", async () => {
    // Arrange
    const token = tenantB.token;
    const target = attestation;

    // Act
    const response = await withToken(api().get(`/backoffice/verifications/${target.id}`), token);

    // Assert
    expect(response.status).toBe(404);
  });
});
