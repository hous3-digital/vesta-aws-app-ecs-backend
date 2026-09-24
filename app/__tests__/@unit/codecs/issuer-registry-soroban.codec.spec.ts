import {
  decodeRegistryParticipant,
  encodeCommissionTerms,
  encodeRoles,
} from "@src/modules/issuer/soroban-issuer-registry.gateway";
import { scValToNative } from "@stellar/stellar-sdk";

describe("issuer registry Soroban codec", () => {
  it("encodes Rust union variants and commission structs with the contract field names", () => {
    expect(scValToNative(encodeRoles(["TECHNICAL", "COMMERCIAL"]))).toEqual([["Technical"], ["Commercial"]]);
    expect(
      scValToNative(
        encodeCommissionTerms([
          { role: "TECHNICAL", shareBps: 6_000 },
          { role: "COMMERCIAL", shareBps: 4_000 },
        ]),
      ),
    ).toEqual([
      { role: ["Technical"], share_bps: 6_000 },
      { role: ["Commercial"], share_bps: 4_000 },
    ]);
  });

  it("normalizes the contract response without leaking Soroban-specific field names", () => {
    expect(
      decodeRegistryParticipant({
        did: "did:pkh:stellar:testnet:GISSUER",
        roles: [["Technical"], ["Commercial"]],
        payout_address: "GPAYOUT",
        commission_terms: [
          { role: ["Technical"], share_bps: 6_000 },
          { role: ["Commercial"], share_bps: 4_000 },
        ],
        authorized_credential_types: ["VestaKYCCredential"],
        status: ["Active"],
        registered_at: 100n,
        updated_at: 200n,
      }),
    ).toEqual({
      did: "did:pkh:stellar:testnet:GISSUER",
      roles: ["TECHNICAL", "COMMERCIAL"],
      payoutAddress: "GPAYOUT",
      commissionTerms: [
        { role: "TECHNICAL", shareBps: 6_000 },
        { role: "COMMERCIAL", shareBps: 4_000 },
      ],
      authorizedCredentialTypes: ["VestaKYCCredential"],
      status: "ACTIVE",
      registeredAt: 100,
      updatedAt: 200,
    });
  });
});
