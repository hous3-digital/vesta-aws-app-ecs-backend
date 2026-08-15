import { ProofPublicSubmitHandler } from "@src/modules/proof/application/public/handlers/proof-public-submit.handler";
import { ProofPublicSubmitSignedHandler } from "@src/modules/proof/application/public/handlers/proof-public-submit-signed.handler";
import { ProofPublicSubmitCommand } from "@src/modules/proof/application/public/commands/proof-public-submit.command";
import { ProofPublicSubmitSignedCommand } from "@src/modules/proof/application/public/commands/proof-public-submit-signed.command";
import type { IAttestationRepository } from "@src/modules/proof/domain/attestation.repository";
import type { ICredentialRepository } from "@src/modules/credential/domain/credential.repository";
import type { IIssuerRepository } from "@src/modules/issuer/domain/issuer.repository";
import type { ZkService } from "@src/modules/zk/zk.service";
import type { StellarService } from "@src/modules/stellar/stellar.service";
import type { WalletService } from "@src/modules/wallet/wallet.service";
import type { PrepareSessionService } from "@src/modules/proof/application/services/prepare-session.service";

const stellarResult = { txHash: "tx", ledger: 10, onChainResult: true, mock: true };

describe("proof issuer propagation", () => {
  it("snapshots the resolved credential issuer in the external submit flow", async () => {
    const save = jest.fn().mockImplementation(async (value) => value);
    const handler = new ProofPublicSubmitHandler(
      { saveOrThrow: save } as unknown as IAttestationRepository,
      { findByVcHash: jest.fn().mockResolvedValue({
        id: { value: "credential_1" }, issuerId: "issuer_a", kycLevel: "basic",
        isApproved: () => true, isExpired: () => false,
      }) } as unknown as ICredentialRepository,
      { findByExternalId: jest.fn().mockResolvedValue({ externalId: "issuer_a" }) } as unknown as IIssuerRepository,
      { loadVerificationKey: jest.fn().mockReturnValue({
        alpha: Buffer.alloc(64), beta: Buffer.alloc(128), gamma: Buffer.alloc(128),
        delta: Buffer.alloc(128), ic: [Buffer.alloc(64), Buffer.alloc(64)],
      }) } as unknown as ZkService,
      { submitZkProof: jest.fn().mockResolvedValue(stellarResult), getContractId: () => "contract" } as unknown as StellarService,
    );

    await handler.execute(new ProofPublicSubmitCommand(
      "vc_hash",
      { pi_a: ["1", "2", "1"], pi_b: [["1", "2"], ["3", "4"], ["1", "0"]], pi_c: ["5", "6", "1"], protocol: "groth16", curve: "bn128" },
      ["1"],
      "verifier",
    ));

    expect(save.mock.calls[0][0].issuerId).toBe("issuer_a");
  });

  it("carries the issuer snapshot from prepare into submit-signed", async () => {
    const save = jest.fn().mockImplementation(async (value) => value);
    const session = {
      vcHash: "vc_hash", proofHash: "proof_hash", issuerId: "issuer_a", verifierId: "verifier", kycLevel: "basic",
      userWalletAddress: "GUSER", expectedSource: "GUSER", sourceAccountSignedByBackend: true,
      mock: true, zkProof: { protocol: "groth16", curve: "bn128", publicSignals: ["1"] },
    };
    const handler = new ProofPublicSubmitSignedHandler(
      { saveOrThrow: save } as unknown as IAttestationRepository,
      { submitWithFeeBump: jest.fn().mockResolvedValue(stellarResult), getContractId: () => "contract" } as unknown as StellarService,
      {} as WalletService,
      { consume: jest.fn().mockResolvedValue(session) } as unknown as PrepareSessionService,
    );

    await handler.execute(new ProofPublicSubmitSignedCommand("prepare", "signed-xdr", null));

    expect(save.mock.calls[0][0].issuerId).toBe("issuer_a");
    expect(save.mock.calls[0][0].userWalletAddress).toBe("GUSER");
  });
});
