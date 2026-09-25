---
name: chain-gateway
description: How to add or change a Soroban call behind a port - abstract gateway in domain, Stellar adapter in infra, codec isolated, the five-step submit, error mapping and the gateway mock. Use when a task needs a new contract call, a change in an existing gateway, or when touching a file in the chain ESLint allowlist.
---

# Chain gateway

Applies `standard-chain.mdc` (vocabulary, signer, lifecycle, receipts), `standard-module.mdc` (where files live, wiring by token) and `standard-code.mdc` (errors, language). Read them first. For Soroban specifics that are not Vesta's (RPC methods, XDR types, simulation, ZK verifier contracts), use the official Stellar skills, installed once per machine, never vendored:

```
# Claude Code
/plugin marketplace add stellar/stellar-dev-skill
/plugin install stellar-dev@stellar-dev
# Cursor: clone github.com/stellar/stellar-dev-skill and link the sub-skills you need into ~/.cursor/skills/
```

Sub-skills that matter here: `smart-contracts` (contract interface and testing), `data` (Stellar RPC, the preferred read path; Horizon is legacy) and `zk-proofs` (Groth16 verification on Soroban).

## Scope check

| Situation                                            | Do                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| New contract read (query a fact)                     | Mode A, read-only: steps 1 to 4 and 7                                                        |
| New contract write (submit a transaction)            | Mode A, full: all steps                                                                      |
| Change a call in a legacy gateway (ESLint allowlist) | Mode B: move only that call behind a port, shrink the allowlist                              |
| Handler wants to call the SDK directly               | Refuse. Add the operation to a port instead                                                  |
| Contract ABI changed (new field, renamed variant)    | Codec first, with its unit test, then the adapter; the port only changes if the fact changed |
| Payout or commission that credits before a receipt   | Refuse. Rule 3: `onChain*` columns are written only from a receipt                           |

## Mode A: add an operation

1. **Name the fact and the signer.** Write the port method in the module's `domain/{name}.gateway.ts` (abstract class). Plain types in, plain types or `null` out, one typed error class with `code` and optional `txHash`. Say in the JSDoc who signs.
2. **Codec.** Encode and decode in `src/infra/gateways/chain/stellar/{name}.codec.ts` as pure functions over `ScVal`. Field names mirror the Rust contract (`Technical`, `Commercial`, `share_bps`). Unit test in `__tests__/@unit/codecs/{name}.codec.spec.ts` with `scValToNative` round trips; this spec may import the SDK.
3. **Adapter.** `src/infra/gateways/chain/stellar/soroban-{name}.gateway.ts` extends the port. It receives `StellarService` (RPC server, passphrase, contract id, mock mode) and resolves its signer from `EnvService` only for the role the port declared. Reads go through `simulateTransaction` on a read-only call; writes follow the five steps of `standard-chain`: simulate, sign, submit, poll, verify by reading back.
4. **Error mapping.** Each failure point maps to one code: `{NAME}_PREFLIGHT_FAILED`, `{NAME}_SUBMISSION_UNKNOWN`, `{NAME}_CONTRACT_REJECTED`, `{NAME}_TRANSACTION_FAILED`, `{NAME}_CONFIRMATION_TIMEOUT`, `{NAME}_CONFIRMATION_MISMATCH`. Carry the `txHash` from submit onwards. Never swallow an RPC error during polling.
5. **Mock mode.** When `StellarService.isMockMode()` is true, return a receipt with a deterministic fake `txHash` and `ledger` and the fact as the caller would read it. Callers never branch on mock mode.
6. **Wire.** In the module: `{ provide: {Name}Gateway, useClass: Soroban{Name}Gateway }`; export the token, never the class. The module imports `StellarModule`.
7. **Mock for tests.** `__tests__/mocks/gateway/{name}.gateway.mock.ts` exporting `mock{Name}Gateway(): jest.Mocked<{Name}Gateway>` with every method as `jest.fn()`. Handler and service specs use it; they never instantiate the adapter.
8. **Handler.** Calls the port, persists the `txHash` as soon as it exists, writes `onChain*` columns only from the receipt, publishes the domain event after the write (TD-001).
9. **Catalog.** If a QA CT covers the flow, its row in `app/docs/__test__/cenarios.md` names the spec; `yarn catalog:check` enforces it.

## Mode B: touch a legacy gateway

The six `src` files in the ESLint allowlist keep working; the task that touches one moves only the call it needs:

1. Create the port method and codec as in Mode A, in the target paths.
2. Move the SDK code for that call into the new adapter; the legacy file delegates to the port or loses the method.
3. If the legacy file no longer imports the SDK, delete it from `CHAIN_SDK_ALLOWLIST` in `app/eslint.config.js` in the same commit. `yarn lint` proves it.
4. Update the legacy map row in `AGENTS.md` and, when the file was the last of its module, the F3 front in `app/docs/tech-debt.md`.

## Shapes

```ts
// domain/{name}.gateway.ts
export interface SettlementReceipt {
  txHash: string;
  ledger: number;
}

export class PayoutSettlementError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly txHash: string | null = null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Signed by the payout operator. Idempotent per requestId. */
export abstract class PayoutSettlementGateway {
  public abstract settle(input: {
    requestId: string;
    destination: string;
    amountAtomic: bigint;
  }): Promise<SettlementReceipt>;
}
```

```ts
// __tests__/mocks/gateway/payout-settlement.gateway.mock.ts
export function mockPayoutSettlementGateway(): jest.Mocked<PayoutSettlementGateway> {
  return {
    settle: jest.fn(),
  } as unknown as jest.Mocked<PayoutSettlementGateway>;
}
```

## Refuse

- A port method named after a contract function (`invokeRegisterParticipant`) or taking `ScVal`.
- A handler, processor or controller importing `@stellar/stellar-sdk`. ESLint fails; do not add the file to the allowlist.
- Marking a ledger entry settled, credited or anchored without a receipt from step 5.
- A test that mocks the RPC server to "cover" the adapter. Adapters are proven by the e2e suite in mock mode and by contract tests on testnet (F3), never by mocked networks.
- Reading `VESTA_DEPLOYER_SECRET` or any signer secret outside the adapter.
