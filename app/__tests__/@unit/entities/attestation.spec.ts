import { Attestation } from "@src/modules/proof/domain/attestation.entity";

describe("Attestation", () => {
  it("create assigns an attestation id, defaults issuerDid to null and keeps the chain receipt", () => {
    // Arrange & Act
    const attestation = Attestation.create({
      vcHash: "0xabc",
      proofHash: "0xproof",
      verifierId: "verifier_local",
      kycLevel: "complete",
      sorobanTxHash: "txhash",
      sorobanLedger: 42,
      onChainResult: true,
      issuerId: "issuer_local_dev",
      userWalletAddress: null,
    });

    // Assert
    expect(attestation.id.value.startsWith("attestation_")).toBe(true);
    expect(attestation.issuerDid).toBeNull();
    expect(attestation.sorobanTxHash).toBe("txhash");
    expect(attestation.sorobanLedger).toBe(42);
    expect(attestation.onChainResult).toBe(true);
  });
});
