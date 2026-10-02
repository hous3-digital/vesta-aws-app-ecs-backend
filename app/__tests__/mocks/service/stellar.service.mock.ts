import type { StellarService } from "@src/modules/stellar/stellar.service";

export type StellarServiceDouble = jest.Mocked<
  Pick<
    StellarService,
    | "isMockMode"
    | "getContractId"
    | "getDeployerAddress"
    | "getNetworkPassphrase"
    | "submitZkProof"
    | "submitWithFeeBump"
    | "buildUnsignedZkProofTx"
  >
>;

/** A mocked chain: submissions succeed with a fixed receipt, the way StellarService answers with VESTA_CONTRACT_ID=PLACEHOLDER. */
export function mockStellarService(): StellarServiceDouble {
  const receipt = { txHash: "mock_tx_hash", ledger: 10, onChainResult: true, mock: true };
  return {
    isMockMode: jest.fn().mockReturnValue(true),
    getContractId: jest.fn().mockReturnValue("PLACEHOLDER"),
    getDeployerAddress: jest.fn().mockReturnValue("GDEPLOYER"),
    getNetworkPassphrase: jest.fn().mockReturnValue("Test SDF Network ; September 2015"),
    submitZkProof: jest.fn().mockResolvedValue(receipt),
    submitWithFeeBump: jest.fn().mockResolvedValue(receipt),
    buildUnsignedZkProofTx: jest.fn().mockResolvedValue({
      unsignedXdr: "unsigned-xdr",
      innerTxHash: "inner_tx_hash",
      sourceAccountSignedByBackend: true,
    }),
  } as unknown as StellarServiceDouble;
}
