import request = require("supertest");
import { FIXTURE_API_KEY } from "@test/constants";
import { CredentialApiFixture } from "@test/@e2e/fixtures/credential-api.fixture";
import { ProofApiFixture } from "@test/@e2e/fixtures/proof-api.fixture";
import { createTestApp, TestApp } from "@test/helpers/create-test-app.helper";

// Real Groth16 proving (artifacts in zk-artifacts) with Stellar mocked (VESTA_CONTRACT_ID=PLACEHOLDER).
jest.setTimeout(120_000);

interface IssuedCredential {
  vc: unknown;
  vcHash: string;
  cpf: string;
  fullName: string;
  birthDate: string;
}

interface PreparedProof {
  prepareSessionId: string;
  unsignedTxXdr: string;
}

describe("/public/proof", () => {
  let testApp: TestApp;
  const issuedVcHashes: string[] = [];
  const attestationIds: string[] = [];

  const api = () => request(testApp.app.getHttpServer());
  const withKey = (req: request.Test) => req.set("X-Api-Key", FIXTURE_API_KEY);

  const issueCredential = async (): Promise<IssuedCredential> => {
    const body = CredentialApiFixture.issue();
    const response = await withKey(api().post("/public/credential")).send(body);
    issuedVcHashes.push(response.body.data.vcHash);
    return {
      vc: response.body.data.vc,
      vcHash: response.body.data.vcHash,
      cpf: String(body.cpf),
      fullName: String(body.fullName),
      birthDate: String(body.birthDate),
    };
  };

  const fetchChallenge = async (): Promise<string> => {
    const response = await withKey(api().get("/public/auth/challenge"));
    return response.body.data.challenge;
  };

  const prepareProof = async (issued: IssuedCredential): Promise<PreparedProof> => {
    const response = await withKey(api().post("/public/proof/prepare")).send(
      ProofApiFixture.prepare(issued, await fetchChallenge()),
    );
    return response.body.data;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.prisma.commissionLedgerEntry.deleteMany({ where: { attestationId: { in: attestationIds } } });
    await testApp.prisma.attestation.deleteMany({ where: { vcHash: { in: issuedVcHashes } } });
    await testApp.prisma.credential.deleteMany({ where: { vcHash: { in: issuedVcHashes } } });
    await testApp.close();
  });

  it("CT-VESTA-PROOF-001 prepare generates a real Groth16 proof, an unsigned transaction and a session", async () => {
    // Arrange
    const issued = await issueCredential();
    const challenge = await fetchChallenge();

    // Act
    const response = await withKey(api().post("/public/proof/prepare")).send(
      ProofApiFixture.prepare(issued, challenge),
    );

    // Assert
    expect(response.status).toBe(201);
    expect(response.body.data.prepareSessionId).toEqual(expect.any(String));
    expect(response.body.data.unsignedTxXdr).toEqual(expect.any(String));
    expect(response.body.data.zkProof.mock).toBe(false);
    expect(response.body.data.zkProof.publicSignals).toEqual(expect.any(Array));
  });

  describe("submit-signed", () => {
    let issued: IssuedCredential;
    let prepared: PreparedProof;

    beforeAll(async () => {
      issued = await issueCredential();
      prepared = await prepareProof(issued);
    });

    it("CT-VESTA-PROOF-005 consumes the session, submits through the mocked Stellar and persists the attestation", async () => {
      // Act
      const response = await withKey(api().post("/public/proof/submit-signed")).send(
        ProofApiFixture.submitSigned(prepared),
      );

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.data.stellar.mock).toBe(true);
      expect(response.body.data.attestation.vcHash).toBe(issued.vcHash);
      const attestationId = response.body.data.attestation.id;
      attestationIds.push(attestationId);
      const row = await testApp.prisma.attestation.findUnique({ where: { id: attestationId } });
      expect(row?.sorobanTxHash).toEqual(expect.any(String));
    });

    it("CT-VESTA-PROOF-007 the attestation credits the issuer with a PENDING_SECURITY ledger entry", async () => {
      // Act
      const entry = await testApp.prisma.commissionLedgerEntry.findUnique({
        where: { attestationId: attestationIds[0] },
      });

      // Assert
      expect(entry?.status).toBe("PENDING_SECURITY");
      expect(entry?.entryType).toBe("ACCRUAL");
      expect(entry?.amountMinor).toBeGreaterThan(0);
      expect(entry?.onChainTxHash).toBeNull();
    });

    it("CT-VESTA-PROOF-006 a consumed session is rejected with 400", async () => {
      // Act
      const response = await withKey(api().post("/public/proof/submit-signed")).send(
        ProofApiFixture.submitSigned(prepared),
      );

      // Assert
      expect(response.status).toBe(400);
    });

    it("CT-VESTA-PROOF-006 an unknown session is rejected with 400", async () => {
      // Act
      const response = await withKey(api().post("/public/proof/submit-signed")).send(
        ProofApiFixture.submitSigned({
          prepareSessionId: "prep_does_not_exist",
          unsignedTxXdr: prepared.unsignedTxXdr,
        }),
      );

      // Assert
      expect(response.status).toBe(400);
    });

    it("answers 503 with a stable code when the issuer registry is not configured (local has no registry contract)", async () => {
      // Act
      const response = await withKey(api().get(`/public/attestations/${attestationIds[0]}/issuer`));

      // Assert
      expect(response.status).toBe(503);
      expect(JSON.stringify(response.body)).toContain("REGISTRY_NOT_CONFIGURED");
    });
  });
});
