import { StrKey } from "@stellar/stellar-sdk";

export type StellarDidNetwork = "testnet" | "pubnet";
export type OrganizationWalletNetwork = "testnet" | "mainnet";

const STELLAR_DID_PKH_PATTERN = /^did:pkh:stellar:(testnet|pubnet):(G[A-Z2-7]{55})$/;

/**
 * Canonical public identity for a Vesta issuer.
 *
 * `did:stellar` is intentionally not accepted until an interoperable method
 * specification defines its syntax and resolution rules. The current adapter
 * uses the generative did:pkh shape over the Stellar CAIP namespace.
 */
export class IssuerDid {
  private constructor(
    private readonly canonicalValue: string,
    private readonly stellarNetwork: StellarDidNetwork,
    private readonly stellarAccount: string,
  ) {}

  public static parse(value: string): IssuerDid {
    const canonicalValue = value.trim();
    const match = STELLAR_DID_PKH_PATTERN.exec(canonicalValue);
    if (!match) {
      throw new Error("Issuer DID must use did:pkh:stellar:<testnet|pubnet>:<G...>");
    }

    const [, network, account] = match;
    if (!StrKey.isValidEd25519PublicKey(account)) {
      throw new Error("Issuer DID contains an invalid Stellar public account");
    }

    return new IssuerDid(canonicalValue, network as StellarDidNetwork, account);
  }

  public static fromStellarAccount(account: string, network: OrganizationWalletNetwork): IssuerDid {
    const stellarNetwork: StellarDidNetwork = network === "mainnet" ? "pubnet" : "testnet";
    return IssuerDid.parse(`did:pkh:stellar:${stellarNetwork}:${account}`);
  }

  public get value(): string {
    return this.canonicalValue;
  }

  public get method(): "pkh" {
    return "pkh";
  }

  public get network(): StellarDidNetwork {
    return this.stellarNetwork;
  }

  public get account(): string {
    return this.stellarAccount;
  }

  public get verificationMethodId(): string {
    return `${this.canonicalValue}#blockchainAccountId`;
  }
}
