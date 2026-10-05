import { ProofPublicSubmitSignedHandler } from "@src/modules/proof/application/public/handlers/proof-public-submit-signed.handler";
import { ProofPublicSubmitSignedCommand } from "@src/modules/proof/application/public/commands/proof-public-submit-signed.command";
import type { PrepareSession } from "@src/modules/proof/domain/prepare-session.store";
import type { StellarService } from "@src/modules/stellar/stellar.service";
import type { WalletService } from "@src/modules/wallet/application/services/wallet.service";
import { mockAttestationRepository } from "@test/mocks/repository/attestation.repository.mock";
import { mockPrepareSessionStore } from "@test/mocks/repository/prepare-session.store.mock";
import { mockStellarService } from "@test/mocks/service/stellar.service.mock";
import { mockWalletService } from "@test/mocks/service/wallet.service.mock";

const sessionModel = (overrides: Partial<PrepareSession> = {}): PrepareSession => ({
  vcHash: "vc_hash",
  proofHash: "proof_hash",
  issuerId: "issuer_a",
  issuerDid: "did:pkh:stellar:testnet:GISSUER",
  verifierId: "verifier",
  kycLevel: "basic",
  userWalletAddress: "GUSER",
  expectedSource: "GUSER",
  innerTxHash: "inner_tx_hash",
  sourceAccountSignedByBackend: true,
  mock: true,
  zkProof: { protocol: "groth16", curve: "bn128", publicSignals: ["1"] },
  ...overrides,
});

const makeSut = () => {
  const attestationRepository = mockAttestationRepository();
  const stellarService = mockStellarService();
  const walletService = mockWalletService();
  const prepareSessionStore = mockPrepareSessionStore();
  const sut = new ProofPublicSubmitSignedHandler(
    attestationRepository,
    stellarService as unknown as StellarService,
    walletService as unknown as WalletService,
    prepareSessionStore,
  );
  return { sut, attestationRepository, stellarService, walletService, prepareSessionStore };
};

describe("ProofPublicSubmitSignedHandler", () => {
  it("carries the issuer snapshot from prepare into the attestation", async () => {
    // Arrange
    const { sut, attestationRepository, prepareSessionStore } = makeSut();
    prepareSessionStore.consume.mockResolvedValue(sessionModel());

    // Act
    await sut.execute(new ProofPublicSubmitSignedCommand("prepare", "signed-xdr", null));

    // Assert
    const saved = attestationRepository.saveOrThrow.mock.calls[0][0];
    expect(saved.issuerId).toBe("issuer_a");
    expect(saved.issuerDid).toBe("did:pkh:stellar:testnet:GISSUER");
    expect(saved.userWalletAddress).toBe("GUSER");
  });
});
