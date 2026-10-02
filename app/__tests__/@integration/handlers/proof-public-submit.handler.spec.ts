import { ProofPublicSubmitHandler } from "@src/modules/proof/application/public/handlers/proof-public-submit.handler";
import { ProofPublicSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-submit.command";
import { CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import type { StellarService } from "@src/modules/stellar/stellar.service";
import type { ZkService } from "@src/modules/zk/application/services/zk.service";
import { InvalidStateError } from "@src/shared/errors";
import type { Groth16Proof } from "@src/shared/types/vesta-vc.types";
import { credentialModel } from "@test/mocks/model/credential.model";
import { issuerModel } from "@test/mocks/model/issuer.model";
import { vestaVcModel } from "@test/mocks/model/vesta-vc.model";
import { mockAttestationRepository } from "@test/mocks/repository/attestation.repository.mock";
import { mockCredentialRepository } from "@test/mocks/repository/credential.repository.mock";
import { mockIssuerRepository } from "@test/mocks/repository/issuer.repository.mock";
import { mockStellarService } from "@test/mocks/service/stellar.service.mock";
import { mockZkService } from "@test/mocks/service/zk.service.mock";

const VC_HASH = "vc_hash";
const VERIFIER_ID = "verifier";

/** Well-formed points: the encoder accepts them, only the pairing check (mocked here) would reject them. */
const wellFormedProof = (): Groth16Proof => ({
  pi_a: ["1", "2", "1"],
  pi_b: [
    ["1", "2"],
    ["3", "4"],
    ["1", "0"],
  ],
  pi_c: ["5", "6", "1"],
  protocol: "groth16",
  curve: "bn128",
});

/** Decimal field elements, as Poseidon hashes travel; the encoder rejects anything else. */
const HASHES = { cpfHash: "11", birthDateHash: "22", fullNameHash: "33" };
const publicSignals = ["1", HASHES.cpfHash, HASHES.birthDateHash, HASHES.fullNameHash, "1"];
const storedVc = () =>
  vestaVcModel({
    credential_subject: {
      ...vestaVcModel().credential_subject,
      cpf_hash: HASHES.cpfHash,
      birth_date_hash: HASHES.birthDateHash,
      full_name_hash: HASHES.fullNameHash,
    },
  });

const command = (proof: Groth16Proof = wellFormedProof()) =>
  new ProofPublicSubmitCommand(VC_HASH, proof, publicSignals, VERIFIER_ID);

const makeSut = () => {
  const attestationRepository = mockAttestationRepository();
  const credentialRepository = mockCredentialRepository();
  const issuerRepository = mockIssuerRepository();
  const zkService = mockZkService();
  const stellarService = mockStellarService();
  credentialRepository.findByVcHash.mockResolvedValue(
    credentialModel({ vcHash: VC_HASH, issuerId: "issuer_a", vcDocument: storedVc() }),
  );
  const issuer = issuerModel({ externalId: "issuer_a" });
  issuerRepository.findByExternalId.mockResolvedValue(issuer);
  const sut = new ProofPublicSubmitHandler(
    attestationRepository,
    credentialRepository,
    issuerRepository,
    zkService as unknown as ZkService,
    stellarService as unknown as StellarService,
  );
  return { sut, attestationRepository, credentialRepository, issuerRepository, zkService, stellarService, issuer };
};

describe("ProofPublicSubmitHandler", () => {
  it("CT-VESTA-PROOF-008 verifies the proof against the stored VC hashes and submits it once", async () => {
    // Arrange
    const { sut, zkService, stellarService, attestationRepository, issuer } = makeSut();

    // Act
    const result = await sut.execute(command());

    // Assert
    expect(zkService.verifyProof).toHaveBeenCalledWith(
      expect.objectContaining({ protocol: "groth16" }),
      publicSignals,
      HASHES,
    );
    expect(stellarService.submitZkProof).toHaveBeenCalledTimes(1);
    expect(result.verified).toBe(true);
    const saved = attestationRepository.saveOrThrow.mock.calls[0][0];
    expect(saved.issuerId).toBe("issuer_a");
    expect(saved.issuerDid).toBe(issuer.did?.value);
  });

  it("CT-VESTA-PROOF-008 rejects an invalid proof with PROOF_INVALID before any chain call", async () => {
    // Arrange
    const { sut, zkService, stellarService } = makeSut();
    zkService.verifyProof.mockRejectedValue(new InvalidStateError("PROOF_INVALID", "Groth16 proof does not verify"));

    // Act
    const act = sut.execute(command());

    // Assert
    await expect(act).rejects.toMatchObject({ code: "PROOF_INVALID" });
    expect(stellarService.submitZkProof).not.toHaveBeenCalled();
  });

  it("CT-VESTA-PROOF-008 rejects public signals of another credential with PROOF_PUBLIC_SIGNALS_MISMATCH before any chain call", async () => {
    // Arrange
    const { sut, zkService, stellarService } = makeSut();
    zkService.verifyProof.mockRejectedValue(
      new InvalidStateError("PROOF_PUBLIC_SIGNALS_MISMATCH", "Public signals do not match the credential"),
    );

    // Act
    const act = sut.execute(command());

    // Assert
    await expect(act).rejects.toMatchObject({ code: "PROOF_PUBLIC_SIGNALS_MISMATCH" });
    expect(stellarService.submitZkProof).not.toHaveBeenCalled();
  });

  it("CT-VESTA-PROOF-008 rejects a proof whose points are not integers with PROOF_MALFORMED", async () => {
    // Arrange
    const { sut, zkService, stellarService } = makeSut();
    const malformed = { ...wellFormedProof(), pi_a: ["not-a-number", "2", "1"] };

    // Act
    const act = sut.execute(command(malformed));

    // Assert
    await expect(act).rejects.toMatchObject({ code: "PROOF_MALFORMED" });
    expect(zkService.verifyProof).not.toHaveBeenCalled();
    expect(stellarService.submitZkProof).not.toHaveBeenCalled();
  });

  it("CT-VESTA-PROOF-008 asks for a reissue when the credential has no stored VC document", async () => {
    // Arrange
    const { sut, credentialRepository, zkService, stellarService } = makeSut();
    credentialRepository.findByVcHash.mockResolvedValue(credentialModel({ vcHash: VC_HASH, vcDocument: null }));

    // Act
    const act = sut.execute(command());

    // Assert
    await expect(act).rejects.toMatchObject({ code: "CREDENTIAL_REISSUE_REQUIRED" });
    expect(zkService.verifyProof).not.toHaveBeenCalled();
    expect(stellarService.submitZkProof).not.toHaveBeenCalled();
  });

  it("rejects an unknown credential with CREDENTIAL_NOT_FOUND", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByVcHash.mockResolvedValue(null);

    // Act
    const act = sut.execute(command());

    // Assert
    await expect(act).rejects.toMatchObject({ code: "CREDENTIAL_NOT_FOUND" });
  });

  it("rejects a credential that is not active with CREDENTIAL_NOT_APPROVED", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByVcHash.mockResolvedValue(
      credentialModel({ vcHash: VC_HASH, status: CredentialStatus.Revoked, vcDocument: storedVc() }),
    );

    // Act
    const act = sut.execute(command());

    // Assert
    await expect(act).rejects.toMatchObject({ code: "CREDENTIAL_NOT_APPROVED" });
  });

  it("rejects an expired credential with CREDENTIAL_EXPIRED", async () => {
    // Arrange
    const { sut, credentialRepository } = makeSut();
    credentialRepository.findByVcHash.mockResolvedValue(
      credentialModel({ vcHash: VC_HASH, expiresAt: new Date("2020-01-01T00:00:00.000Z"), vcDocument: storedVc() }),
    );

    // Act
    const act = sut.execute(command());

    // Assert
    await expect(act).rejects.toMatchObject({ code: "CREDENTIAL_EXPIRED" });
  });
});
