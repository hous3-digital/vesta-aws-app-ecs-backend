# Vesta payout vault

Soroban vault for on-demand, full-balance organization payouts.

The contract stores only an opaque 32-byte payout identifier, recipient
address, atomic token amount and settlement timestamp. It never receives CPF,
credential hashes, issuer names or other personal data.

## Roles

- `admin`: changes operator/guardian and authorizes upgrades.
- `operator`: invokes `settle`; use a dedicated payout key, never the verifier deployer key.
- `guardian`: pauses settlement during an incident.
- `treasury`: deposits the configured token into the vault.

## Deployment gate

Before enabling the backend:

1. Compile and test the contract in CI.
2. Deploy it to Stellar testnet and initialize it atomically with distinct role addresses and the chosen SAC token contract.
3. Fund the vault with the settlement token and verify its balance.
4. Store the operator secret in AWS Secrets Manager and expose it only as `STELLAR_PAYOUT_OPERATOR_SECRET` to the backend task.
5. Set `STELLAR_PAYOUT_CONTRACT_ID` to the deployed contract ID.
6. Run an end-to-end payout and duplicate-ID test in testnet.
7. Obtain the formal legal/regulatory opinion and an external contract audit before mainnet.

`STELLAR_PAYOUT_CONTRACT_ID=PLACEHOLDER` deliberately keeps settlement disabled.
