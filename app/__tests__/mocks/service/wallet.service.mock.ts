import type { WalletService } from "@src/modules/wallet/application/services/wallet.service";

export type WalletServiceDouble = jest.Mocked<
  Pick<WalletService, "isEnabledForIssuer" | "issueCustomAuthToken" | "precreateForCredential">
>;

/** WalletService is a legacy concrete class (TD-002); Privy is off by default, cast at the constructor. */
export function mockWalletService(): WalletServiceDouble {
  return {
    isEnabledForIssuer: jest.fn().mockResolvedValue(false),
    issueCustomAuthToken: jest.fn().mockRejectedValue(new Error("issueCustomAuthToken has no default")),
    precreateForCredential: jest.fn().mockRejectedValue(new Error("precreateForCredential has no default")),
  } as unknown as WalletServiceDouble;
}
