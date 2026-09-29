import type { VestaVC } from "@src/shared/types/vesta-vc.types";
import { FIXTURE_ISSUER_EXTERNAL_ID } from "@test/constants";

/** A signed-looking VC document with hashed subject fields only; no PII. */
export function vestaVcModel(overrides: Partial<VestaVC> = {}): VestaVC {
  const issuerDid = "did:pkh:stellar:testnet:GAAAA";
  return {
    "@context": ["https://www.w3.org/2018/credentials/v1"],
    id: "urn:uuid:00000000-0000-4000-8000-000000000001",
    type: ["VerifiableCredential", "VestaKYCCredential"],
    issuer: { id: issuerDid, name: "Local Bank" },
    issuance_date: "2026-01-01T00:00:00.000Z",
    expiration_date: "2027-01-01T00:00:00.000Z",
    credential_subject: {
      id: "did:key:subject",
      cpf_hash: "poseidon-cpf-hash",
      birth_date_hash: "poseidon-birth-date-hash",
      full_name_hash: "poseidon-full-name-hash",
      kyc_level: "complete",
      kyc_provider: FIXTURE_ISSUER_EXTERNAL_ID,
      kyc_method: "document",
      nationality: "BR",
    },
    proof: {
      type: "Ed25519Signature2020",
      created: "2026-01-01T00:00:00.000Z",
      verificationMethod: `${issuerDid}#blockchainAccountId`,
      proofPurpose: "assertionMethod",
      proofValue: "zproof",
    },
    ...overrides,
  };
}
