import { IssuerDid } from "@src/modules/issuer/domain/issuer-did.value-object";

const VALID_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

describe("IssuerDid", () => {
  it("parse accepts did:pkh:stellar with a valid account and exposes its parts", () => {
    // Arrange & Act
    const did = IssuerDid.parse(` did:pkh:stellar:testnet:${VALID_ACCOUNT} `);

    // Assert
    expect(did.value).toBe(`did:pkh:stellar:testnet:${VALID_ACCOUNT}`);
    expect(did.method).toBe("pkh");
    expect(did.network).toBe("testnet");
    expect(did.account).toBe(VALID_ACCOUNT);
    expect(did.verificationMethodId).toBe(`did:pkh:stellar:testnet:${VALID_ACCOUNT}#blockchainAccountId`);
  });

  it.each([
    ["did:stellar method", `did:stellar:${VALID_ACCOUNT}`],
    ["unknown network", `did:pkh:stellar:mainnet:${VALID_ACCOUNT}`],
    [
      "account with a bad checksum",
      "did:pkh:stellar:testnet:GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    ],
  ])("parse rejects %s", (_case, value) => {
    // Act
    const act = () => IssuerDid.parse(value);

    // Assert
    expect(act).toThrow(Error);
  });

  it("fromStellarAccount maps mainnet to pubnet and testnet to testnet", () => {
    // Arrange & Act
    const pubnet = IssuerDid.fromStellarAccount(VALID_ACCOUNT, "mainnet");
    const testnet = IssuerDid.fromStellarAccount(VALID_ACCOUNT, "testnet");

    // Assert
    expect(pubnet.network).toBe("pubnet");
    expect(testnet.network).toBe("testnet");
  });
});
