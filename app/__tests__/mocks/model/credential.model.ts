import { Credential, CredentialStatus, type CredentialProps } from "@src/modules/credential/domain/credential.entity";
import { Id } from "@src/shared/value-objects/id.value-object";
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";

/** An ACTIVE credential of the fixture issuer, restored as if read from the database. */
export function credentialModel(overrides: Partial<CredentialProps> = {}): Credential {
  return Credential.restore({
    id: Id.restore("credential_01"),
    vcHash: "0xabc",
    vcDocument: null,
    cpfDedupKey: "hmac-cpf-dedup-key",
    issuerDid: "did:pkh:stellar:testnet:GAAAA",
    issuerId: FIXTURE_ISSUER_EXTERNAL_ID,
    subjectDid: "did:key:subject",
    kycLevel: "complete",
    status: CredentialStatus.Active,
    sorobanTxHash: null,
    userWalletAddress: null,
    privyUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    ...overrides,
  });
}
