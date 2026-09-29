import { IssuerDid } from "@src/modules/issuer/domain/issuer-did.value-object";
import { Issuer, IssuerProps } from "@src/modules/issuer/domain/issuer.entity";

const VALID_ACCOUNT = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

const restoreWith = (overrides: Partial<IssuerProps> = {}): Issuer =>
  Issuer.restore({
    id: "issuer_local_dev",
    externalId: "local_bank",
    name: "Banco Local Dev",
    status: "active",
    publicKey: null,
    privyEnabled: false,
    did: IssuerDid.parse(`did:pkh:stellar:testnet:${VALID_ACCOUNT}`),
    roles: ["TECHNICAL", "COMMERCIAL"],
    authorizedCredentialTypes: ["VestaKYCCredential"],
    registryStatus: "REGISTERED",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  });

describe("Issuer", () => {
  it("CT-VESTA-CRED-006 isActive is true only for status active", () => {
    // Arrange
    const active = restoreWith({ status: "active" });
    const inactive = restoreWith({ status: "inactive" });

    // Act & Assert
    expect(active.isActive()).toBe(true);
    expect(inactive.isActive()).toBe(false);
  });

  it("hasRole answers per role and deduplicates roles", () => {
    // Arrange
    const issuer = restoreWith({ roles: ["TECHNICAL", "TECHNICAL"] });

    // Act & Assert
    expect(issuer.roles).toEqual(["TECHNICAL"]);
    expect(issuer.hasRole("TECHNICAL")).toBe(true);
    expect(issuer.hasRole("COMMERCIAL")).toBe(false);
  });

  it("CT-VESTA-CRED-006 canIssueCredentialType checks the authorized list", () => {
    // Arrange
    const issuer = restoreWith({ authorizedCredentialTypes: ["VestaKYCCredential"] });

    // Act & Assert
    expect(issuer.canIssueCredentialType("VestaKYCCredential")).toBe(true);
    expect(issuer.canIssueCredentialType("OtherCredential")).toBe(false);
  });

  describe("isRegistryReady", () => {
    it("CT-VESTA-ADMIN-006 is true when REGISTERED with a DID and at least one role", () => {
      // Arrange
      const issuer = restoreWith();

      // Act & Assert
      expect(issuer.isRegistryReady()).toBe(true);
    });

    it("CT-VESTA-ADMIN-006 is false without a DID", () => {
      // Arrange
      const issuer = restoreWith({ did: null });

      // Act & Assert
      expect(issuer.isRegistryReady()).toBe(false);
    });

    it("CT-VESTA-ADMIN-006 is false without roles", () => {
      // Arrange
      const issuer = restoreWith({ roles: [] });

      // Act & Assert
      expect(issuer.isRegistryReady()).toBe(false);
    });

    it.each(["UNREGISTERED", "SUSPENDED"] as const)("is false when registryStatus is %s", (registryStatus) => {
      // Arrange
      const issuer = restoreWith({ registryStatus: registryStatus });

      // Act & Assert
      expect(issuer.isRegistryReady()).toBe(false);
    });
  });
});
