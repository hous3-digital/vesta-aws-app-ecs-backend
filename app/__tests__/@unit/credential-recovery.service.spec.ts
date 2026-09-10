import { BadRequestException, ConflictException } from "@nestjs/common";
import { CredentialRecoveryService } from "@src/modules/challenge/credential-recovery.service";
import { Credential } from "@src/modules/credential/domain/credential.entity";
import type { VestaVC } from "@src/shared/types/vesta-vc.types";

const vc: VestaVC = {
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  id: "urn:uuid:recovery-test",
  type: ["VerifiableCredential", "VestaKYCCredential"],
  issuer: { id: "did:web:vesta.test:issuer-1", name: "Issuer" },
  issuance_date: "2026-09-02T12:00:00.000Z",
  expiration_date: "2099-09-02T12:00:00.000Z",
  credential_subject: {
    id: "did:key:holder",
    cpf_hash: "1",
    birth_date_hash: "2",
    full_name_hash: "3",
    kyc_level: "complete",
    kyc_provider: "test",
    kyc_method: "document_verification",
    nationality: "BR",
  },
  proof: {
    type: "PoseidonSignature2024",
    created: "2026-09-02T12:00:00.000Z",
    verificationMethod: "did:web:vesta.test#key-1",
    proofPurpose: "assertionMethod",
    proofValue: "zTest",
  },
};

describe("CredentialRecoveryService", () => {
  const challengeService = { consumeContext: jest.fn() };
  const credentialRepository = { findByVcHash: jest.fn() };
  const vcService = { hashVC: jest.fn().mockReturnValue("vc-hash") };
  const service = new CredentialRecoveryService(
    challengeService as never,
    credentialRepository as never,
    vcService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("devolve a VC somente após consumir token vinculado ao issuer e vcHash", async () => {
    challengeService.consumeContext.mockResolvedValue({
      kind: "credential-recovery",
      issuerId: "issuer-1",
      rpId: "app.example.com",
      vcHash: "vc-hash",
    });
    credentialRepository.findByVcHash.mockResolvedValue(Credential.issue({
      vcHash: "vc-hash",
      vcDocument: vc,
      cpfDedupKey: null,
      issuerDid: vc.issuer.id,
      issuerId: "issuer-1",
      subjectDid: vc.credential_subject.id,
      kycLevel: "complete",
      expiresAt: new Date(vc.expiration_date),
    }));

    await expect(service.recover("issuer-1", "one-time-token")).resolves.toEqual({
      vc,
      vcHash: "vc-hash",
    });
  });

  it("rejeita token inválido ou já consumido", async () => {
    challengeService.consumeContext.mockResolvedValue(null);
    await expect(service.recover("issuer-1", "invalid")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("orienta revalidação para credenciais legadas sem documento persistido", async () => {
    challengeService.consumeContext.mockResolvedValue({
      kind: "credential-recovery",
      issuerId: "issuer-1",
      rpId: "app.example.com",
      vcHash: "vc-hash",
    });
    credentialRepository.findByVcHash.mockResolvedValue(Credential.issue({
      vcHash: "vc-hash",
      cpfDedupKey: null,
      issuerDid: vc.issuer.id,
      issuerId: "issuer-1",
      subjectDid: vc.credential_subject.id,
      kycLevel: "complete",
      expiresAt: new Date(vc.expiration_date),
    }));

    await expect(service.recover("issuer-1", "one-time-token")).rejects.toBeInstanceOf(ConflictException);
  });
});
