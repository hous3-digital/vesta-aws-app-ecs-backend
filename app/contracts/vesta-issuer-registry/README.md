# Vesta issuer registry

Minimal Soroban registry for Vesta participants. It exposes public DID-based
lookups while reserving every mutation for the configured Vesta authority.

The contract treats a DID as an opaque, canonical identifier. This keeps the
ABI compatible with the current Stellar `did:pkh` representation and with a
future interoperable `did:stellar` method without coupling the registry to a
specific resolver.

## Stored participant data

- DID and active/suspended status;
- technical and/or commercial roles;
- Stellar payout address;
- commission share per role, expressed as integer basis points;
- authorized credential types;
- registration and last-update timestamps.

The persistent ledger key is the SHA-256 digest of the DID. The full DID stays
in the participant value and in contract events. Participant entries extend
their TTL on every read and write.

## Contract behavior

- `initialize` and every mutation require authorization from the Vesta admin.
- `get_participant` and `is_active` are public.
- An exact repeated registration is idempotent and emits no duplicate event.
- A conflicting repeated registration fails and must use `update_participant`.
- A suspended participant remains queryable but is not active.
- Updating metadata preserves status and the original registration timestamp.

## Deliberate limits

This contract does not execute payouts, persist a complete change history,
implement multisignature governance, parse DID methods, or integrate directly
with the NestJS backend. Backend registration and resolution are a separate
delivery.

## Staging deployment

The Release 3 registry is deployed and initialized on Stellar Testnet:

- contract: `CCMM5MZXJ6C3WLHDCYQFOS32L2F6YNACCLVEWGTKFJTSYZX5PT5YXIWP`;
- version: `1`;
- admin: `GDUFIQROJ7CMF5AW3EGGG3LSB6QP5M5ASKL62HBX5TAR4ZNQWYQQI5ZK`;
- deployment salt: SHA-256 of `vesta-issuer-registry:r3:testnet:v1`.

The salt makes the staging deployment address deterministic for this admin.
The private admin seed remains in Secrets Manager as `VESTA_DEPLOYER_SECRET`
and must never be committed or printed.

## Validation

```bash
cargo test --manifest-path app/contracts/vesta-issuer-registry/Cargo.toml
cargo build \
  --manifest-path app/contracts/vesta-issuer-registry/Cargo.toml \
  --target wasm32v1-none \
  --release
```
