import { BadRequestException } from "@nestjs/common";
import { Credential, CredentialStatus } from "@src/modules/credential/domain/credential.entity";
import { Id } from "@src/shared/value-objects/id.value-object";

const issueParams = {
  vcHash: "0xabc",
  cpfDedupKey: "hmac-cpf",
  issuerDid: "did:pkh:stellar:testnet:GAAAA",
  issuerId: "issuer_local_dev",
  subjectDid: "did:key:subject",
  kycLevel: "complete" as const,
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
};

const restoreWith = (status: CredentialStatus, expiresAt = new Date("2099-01-01T00:00:00.000Z")): Credential =>
  Credential.restore({
    id: Id.restore("credential_01"),
    vcHash: "0xabc",
    vcDocument: null,
    cpfDedupKey: "hmac-cpf",
    issuerDid: "did:pkh:stellar:testnet:GAAAA",
    issuerId: "issuer_local_dev",
    subjectDid: "did:key:subject",
    kycLevel: "complete",
    status: status,
    sorobanTxHash: null,
    userWalletAddress: null,
    privyUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: expiresAt,
  });

describe("Credential", () => {
  describe("issue", () => {
    it("creates an ACTIVE credential with a credential id and no wallet", () => {
      // Arrange & Act
      const credential = Credential.issue(issueParams);

      // Assert
      expect(credential.status).toBe(CredentialStatus.Active);
      expect(credential.id.value.startsWith("credential_")).toBe(true);
      expect(credential.userWalletAddress).toBeNull();
      expect(credential.sorobanTxHash).toBeNull();
      expect(credential.expiresAt).toEqual(issueParams.expiresAt);
    });

    it("CT-VESTA-CRED-002 issuePending creates a PENDING credential", () => {
      // Arrange & Act
      const credential = Credential.issuePending(issueParams);

      // Assert
      expect(credential.status).toBe(CredentialStatus.Pending);
      expect(credential.isPending()).toBe(true);
      expect(credential.isApproved()).toBe(false);
    });
  });

  describe("revoke", () => {
    it("CT-VESTA-CRED-010 moves an ACTIVE credential to REVOKED", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Active);

      // Act
      credential.revoke();

      // Assert
      expect(credential.status).toBe(CredentialStatus.Revoked);
      expect(credential.isRevoked()).toBe(true);
    });

    it("rejects revoking a credential that is already REVOKED", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Revoked);

      // Act
      const act = () => credential.revoke();

      // Assert
      expect(act).toThrow(BadRequestException);
    });
  });

  describe("approve and reject", () => {
    it("CT-VESTA-KYC-001 approve moves PENDING to ACTIVE and updates the kycLevel", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Pending);

      // Act
      credential.approve("intermediate");

      // Assert
      expect(credential.status).toBe(CredentialStatus.Active);
      expect(credential.kycLevel).toBe("intermediate");
    });

    it("CT-VESTA-KYC-002 reject moves PENDING to REJECTED", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Pending);

      // Act
      credential.reject();

      // Assert
      expect(credential.status).toBe(CredentialStatus.Rejected);
      expect(credential.isRejected()).toBe(true);
    });

    it.each([CredentialStatus.Active, CredentialStatus.Revoked, CredentialStatus.Rejected, CredentialStatus.Expired])(
      "CT-VESTA-KYC-004 approve rejects a credential in status %s",
      (status) => {
        // Arrange
        const credential = restoreWith(status);

        // Act
        const act = () => credential.approve("complete");

        // Assert
        expect(act).toThrow(BadRequestException);
      },
    );

    it.each([CredentialStatus.Active, CredentialStatus.Revoked, CredentialStatus.Rejected])(
      "reject rejects a credential in status %s",
      (status) => {
        // Arrange
        const credential = restoreWith(status);

        // Act
        const act = () => credential.reject();

        // Assert
        expect(act).toThrow(BadRequestException);
      },
    );
  });

  describe("predicates", () => {
    it("CT-VESTA-CRED-009 only ACTIVE is approved", () => {
      // Arrange
      const statuses = Object.values(CredentialStatus);

      // Act
      const approved = statuses.filter((status) => restoreWith(status).isApproved());

      // Assert
      expect(approved).toEqual([CredentialStatus.Active]);
    });

    it("isExpired is true when expiresAt is in the past even if the status is ACTIVE", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Active, new Date("2000-01-01T00:00:00.000Z"));

      // Act & Assert
      expect(credential.isExpired()).toBe(true);
      expect(credential.isApproved()).toBe(true);
    });
  });

  describe("attachWallet and attachDocument", () => {
    it("attachWallet records the wallet address and the Privy user", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Active);

      // Act
      credential.attachWallet({ userWalletAddress: "GBBBB", privyUserId: "did:privy:1" });

      // Assert
      expect(credential.userWalletAddress).toBe("GBBBB");
      expect(credential.privyUserId).toBe("did:privy:1");
    });

    it("attachDocument stores the VC document", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Active);
      const document = { id: "urn:uuid:1" } as unknown as NonNullable<Credential["vcDocument"]>;

      // Act
      credential.attachDocument(document);

      // Assert
      expect(credential.vcDocument).toBe(document);
    });
  });
});
