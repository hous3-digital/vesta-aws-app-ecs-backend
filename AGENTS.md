# AGENTS.md

Guide for coding agents (Cursor, Claude Code or any other) working on the Vesta backend. This file is the contract: rules, skills, hooks and CI all derive from it. When something here conflicts with code you find in the repo, this file wins and the code is legacy (see [Legacy map](#legacy-map)).

## What Vesta is

Vesta is a reusable KYC network on Stellar Soroban. An issuer (a bank or KYC provider) verifies a person once and issues a Verifiable Credential (VC). The person keeps the VC and a passkey on their device. Any verifier can later ask the person to prove, with a zero-knowledge proof (Groth16), that they hold a valid VC, without the verifier or Vesta ever seeing the underlying PII. Each successful verification is anchored on-chain as an attestation and generates a commission split between Vesta and the issuers.

This backend is the API behind the Vesta SDK (browser and Node), the issuer backoffice web app and the Vesta admin tooling.

**Current phase**: release "R4 — Arrumar a casa" (security, technical baseline, design), delivery 2026-10-02. There is a **paying client in production** using the SDK and the `/public/*` endpoints. Every change is classified before it is made:

| Class          | Meaning                                                                        | What to do                                      |
| -------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| **Additive**   | New endpoint, new optional field, new module, refactor with identical behavior | Ship                                            |
| **Behavioral** | Existing endpoint answers differently for the same input                       | Check production usage first, note it in the PR |
| **Breaking**   | Contract change on `/public/*` or the SDK                                      | New version or feature flag, never in place     |

## Stack

- **Runtime**: Node.js 22, TypeScript 5.9 (`ES2022`, CommonJS)
- **Framework**: NestJS 11 with CQRS (`@nestjs/cqrs`)
- **Database**: PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`); Redis 7 for challenges and prepare sessions
- **Chain**: Stellar Soroban via `@stellar/stellar-sdk` 15; contracts in Rust under `app/contracts/`
- **ZK**: snarkjs 0.7 + circomlibjs, Groth16 over BN254; circuit artifacts in `app/zk-artifacts/`
- **Auth**: WebAuthn passkeys (`@simplewebauthn/server`), Privy custom auth (JWT ES256), API keys for issuers, JWT for the backoffice, shared secret for admin
- **Observability**: Winston (`nest-winston`), OpenTelemetry API, ingress/egress request logging
- **Package manager**: Yarn 1.22 (pinned via `packageManager`, use `corepack enable`)

## Repository layout

```
.                     # repo root: Makefile, CI, infra, this file
├── app/              # the Node package (package.json lives here)
│   ├── src/          # application source
│   ├── __tests__/    # tests, split by layer (see Testing)
│   ├── config/       # jest configs per layer
│   ├── contracts/    # Soroban contracts (Rust)
│   ├── docs/         # architecture, decisions, audits, module guides
│   ├── scripts/      # local tooling (smoke.mjs)
│   └── zk-artifacts/ # circuit wasm, zkey and verification key
├── infra/            # Terraform (AWS ECS)
├── .github/          # workflows
├── .cursor/          # canonical harness: rules, skills, commands, agents, hooks
└── .claude/          # Claude Code mirror: symlinks into .cursor plus settings.json
```

`make` targets run from the repo root. `yarn` scripts run from `app/`.

## Commands

```bash
# Local environment (from the repo root)
make env        # creates app/.env.local and app/.env.test from their .example files if missing
make up         # Postgres + Redis via docker compose
make db         # prisma generate + migrations + local fixtures
make dev        # API in watch mode reading app/.env.local (http://localhost:3000, Swagger at /docs)
make db-reset   # drops and recreates the LOCAL database and reseeds it (asks for confirmation in the agent)
make smoke      # full flow against the local API: issue -> verify -> challenge -> prepare (real ZK) -> submit (mocked Stellar)
make down       # stops the containers

# Quality (from app/)
yarn lint               # eslint, no autofix
yarn lint:fix           # eslint with autofix
yarn prettier:check     # formatting check
yarn prettier:format    # formats src, __tests__ and harness markdown
yarn typecheck          # tsc --noEmit
yarn test:unit          # __tests__/@unit
yarn test:integration   # __tests__/@integration (needs the compose Postgres)
yarn test:e2e           # __tests__/@e2e: creates the local vesta_test database, migrates, seeds, boots the app in-process
yarn audit:ci           # dependency audit

# Database (from app/)
yarn prisma:gen         # generates the client (output is gitignored)
yarn prisma:migrate     # creates and applies a dev migration
yarn prisma:deploy      # applies pending migrations (staging/prod, run manually before deploy)
```

Local fixtures (`app/src/infra/database/seeds/local-fixtures.sql`): issuer `local_bank`, API key `vesta_live_local_dev_do_not_use_in_production`, backoffice `dev@localhost` / `vesta_local`, verifier `verifier_local`.

## Environments and secrets

- `app/.env` is **staging**. Never read it, never copy from it, never point local tooling at it. Hooks block reading it.
- `app/.env.local` is the local environment and `app/.env.test` is the e2e environment (own database `vesta_test`, `NODE_ENV=local`). Their `.example` templates are the only env files that may be committed.
- Local runs with no Privy, no real contracts (`VESTA_CONTRACT_ID=PLACEHOLDER` means mocked Stellar) and real ZK proofs.
- Environment variables are validated with Zod in `app/src/infra/env/env.schema.ts`. A new variable goes there first, then in `.env.local.example`.
- Secrets never appear in code, tests, fixtures, logs or commit messages. Key material is never logged, not even a prefix.

## Non-negotiable rules

1. **English everywhere in code**: identifiers, comments, JSDoc, Swagger descriptions, commit messages, PR titles. Documentation under `app/docs/` may be in Portuguese.
2. **Chain SDK only inside the adapter.** `@stellar/stellar-sdk` is imported only in `src/modules/stellar/` (and, once it exists, `src/infra/gateways/chain/`). Every other module talks to the chain through a port interface. ESLint enforces this; the current offenders are listed in an explicit allowlist that only shrinks.
3. **Every fact has one declared owner.** The chain owns what a third party must verify without trusting us: an attestation exists, an issuer is active in the registry, a credit or payout settled. Postgres owns everything else: state before submission (cycles, previews, attempts) and off-chain data (KYC, passkeys, API keys, sessions). Consequences: `onChain*`, `*Ledger` and `*TxHash` columns are written only by the receipt or reconciliation path, never by handler logic; a record becomes "settled" or "anchored" only with a receipt; when Postgres and chain disagree on a chain-owned fact, the chain wins and `reconcile` fixes Postgres. There is no event indexer and no rebuildable projection (see `app/docs/tech-debt.md`, TD-001).
4. **PII only as a hash.** CPF and any other identifier is stored and logged only as `HMAC-SHA256(CPF_HMAC_SECRET)` or a Poseidon commitment. Raw PII exists in memory during proving and nowhere else.
5. **Never change a `/public/*` contract in place.** See the change classes above.
6. **No workarounds for a failing gate.** A failing lint, typecheck, test or hook is fixed at the source. Never disable a rule, skip a test, or add `// eslint-disable` to get through.
7. **Absolute imports** with `@src/...` and `@test/...`. Relative imports are blocked by ESLint.
8. **Never reset or drop a database except the local one, through `make db-reset`** (or `yarn db:reset:local`). Both read only `app/.env.local`. Any other reset form (`yarn prisma:reset`, `prisma migrate reset`, `db push --force-reset`, `DROP`, `TRUNCATE`) loads `app/.env`, which is staging, and is blocked by the shell hook. The hook also refuses `make db-reset` if `.env.local` does not point to localhost.

## Architecture

Pragmatic DDD with CQRS. Commands write through repositories and rich entities; queries read through DAOs and return flat read models. Full principles in `app/docs/architecture.md`.

### Target module structure

Every feature module owns its aggregate across all three API contexts. Backoffice and admin views of an aggregate live inside the module that owns it, not in a separate backoffice module.

```
src/modules/{module}/
├── api/
│   ├── public/          # issuer-facing endpoints, API key auth   (/public/...)
│   ├── backoffice/      # issuer backoffice web app, JWT auth     (/backoffice/...)
│   ├── admin/           # Vesta operators, admin secret           (/admin/...)
│   └── common/          # inputs, params and outputs shared across contexts
├── application/
│   ├── public/          # commands, queries, handlers per context
│   ├── backoffice/
│   ├── admin/
│   └── internal/        # event handlers, sagas, crons
├── domain/              # entities, value objects, events, repository interfaces, domain services
├── infra/               # repositories, DAOs, mappers, gateways (chain, KYC providers)
└── {module}.module.ts
```

- File naming: `{module}-{context}-{action}.{controller|command|query|handler|input}.ts`, `{name}.entity.ts`, `{name}.value-object.ts`, `{name}.repository.ts`, `{name}.data-access-object.ts`, `{name}.mapper.ts`, `{name}.gateway.ts`.
- Cross-module dependencies go through an exported interface and a provider token, never by importing another module's service or repository class.
- Business rules live in entities and domain services. Handlers orchestrate: fetch, delegate, persist, publish.
- Identifiers use TypeID (`typeid-js`) through the shared `Id` value object.

### Legacy map

The rules above describe the target. Most of the code does not follow it yet. Two instructions govern the gap:

- **New code is born on target.** No exceptions, including when the surrounding module is legacy.
- **Touching a legacy module migrates only what the task touches.** Never a big-bang refactor. Update this table when a module moves.

| Module                | State (2026-09-24) | Gap                                                                                                                                                                                                                               |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `credential`          | On target          | Backoffice queries still live in `backoffice/credentials`                                                                                                                                                                         |
| `proof`               | On target          | Backoffice queries still live in `backoffice/verifications`                                                                                                                                                                       |
| `issuer`              | Partial            | `domain/` and `infra/` exist; service and gateway sit at the module root; `issuer-did.value-object.ts` imports the chain SDK                                                                                                      |
| `commission`          | Flat               | Services and gateways only, no `domain/`; two gateways import the chain SDK; backoffice controller at the module root; queries live in `backoffice/commissions`                                                                   |
| `challenge`           | Flat               | Three services at the root plus `api/public`                                                                                                                                                                                      |
| `wallet`              | Flat               | Imports the chain SDK; instantiates `JwtService` outside DI                                                                                                                                                                       |
| `vc`, `zk`, `stellar` | Flat               | Single service each; `stellar` is the only legitimate home of the chain SDK today                                                                                                                                                 |
| `backoffice`          | Anti-target        | Bag of six submodules. `verifiers` is a real aggregate and becomes `modules/verifier` first; the read-only submodules dissolve into the modules that own their data; `shared/` utilities move to `src/shared` or `src/infra/auth` |
| `infra/auth`          | Mixed              | Holds admin and backoffice controllers that belong in the modules they operate on                                                                                                                                                 |

## Testing

Tests live in `app/__tests__/`, split by layer, one jest config per layer in `app/config/`. Follow the AAA pattern (`// Arrange`, `// Act`, `// Assert`).

| Layer          | Directory                 | What goes there                                                                                                   | Never goes there                                                                 |
| -------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `@unit`        | `__tests__/@unit/`        | Entities, value objects, formatters, builders. Pure TypeScript, no Nest container, no I/O                         | Handlers, services, controllers, DAOs, repositories, mappers                     |
| `@integration` | `__tests__/@integration/` | Handlers and services **that contain a rule**: branching, validation, transformation, error handling              | Passthrough handlers (fetch, call, return), DAOs, gateways that only wrap an SDK |
| `@e2e`         | `__tests__/@e2e/`         | HTTP contract of every route, booted in-process on the compose Postgres, chain mocked, ZK real. Named by QA CT id | Anything already proven by a lower layer                                         |

- Coverage is collected from `src/**/domain/**` only. A thin domain is a finding, not a reason to test services instead.
- Never test DAOs, provider endpoints or chain gateways with mocked networks.
- If you cannot name the rule a test protects, do not write it.
- Run a single spec: `yarn test:unit __tests__/@unit/entities/credential.spec.ts`.
- What must be tested, case by case, is `app/docs/__test__/cenarios.md`; the tree and conventions are `.cursor/rules/standard-test.mdc`.

## Git and pull requests

- **One branch per product feature**, not per task: `feat/<feature-slug>`, `fix/<slug>` or `chore/<slug>`. Pushing one opens a PR against `staging` automatically, so the PR is the feature.
- **Inside the branch, a task is a group of commits**, never one squashed commit. Scope is the area touched (`chore(harness):`, `feat(credential):`). The tracker task id goes in the footer (`Track: task_...`) so `git log --grep` finds every commit of a task.
- Exceptions that get their own branch: a behavioral or breaking change on `/public/*` (must be revertable alone), a legacy-map migration (keeps logic review clean), and a feature whose PR would pass about 2000 lines (split in two).
- Commits follow Conventional Commits and are checked by commitlint on `commit-msg`: types `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test`, header up to 100 chars, subject at least 15 chars, English.
- Before pushing: `yarn lint`, `yarn typecheck`, `yarn prettier:check`, `yarn test:unit`, `yarn test:integration`.
- Every decision that changes architecture or a rule in this file gets a line in `app/docs/decisions.md` (dated) and, when structural, an ADR in `app/docs/adr/`.

## Harness layout

The harness is agnostic: `.cursor/` is canonical and `.claude/` mirrors it with symlinks, so both agents read one source per artifact.

| Artifact | Location                    | Purpose                                                                                                                                        |
| -------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules    | `.cursor/rules/*.mdc`       | Declarative standards, attached by glob. Each rule states what, why and the trigger                                                            |
| Skills   | `.cursor/skills/*/SKILL.md` | Procedures (create a module, write a unit test, add a chain gateway). Each skill opens by citing the rules it applies                          |
| Commands | `.cursor/commands/*.md`     | Spec-driven flow: `/create-prd`, `/create-tech-spec`, `/create-task`, `/exec-task`                                                             |
| Agents   | `.cursor/agents/*.md`       | Specialists such as `code-reviewer`, which reviews a diff against this file and the rules                                                      |
| Hooks    | `.cursor/hooks/*.js`        | Sensors: format and lint on every edit, block secret reads, block destructive shell. Wired in `.cursor/hooks.json` and `.claude/settings.json` |
| Specs    | `tasks/prd-{feature}/`      | PRD, tech spec and task files produced by the commands                                                                                         |

Before touching an area, read its guide:

| When touching                              | Read                                                     |
| ------------------------------------------ | -------------------------------------------------------- |
| Any module structure or a new module       | `app/docs/architecture.md`, `app/docs/modules/README.md` |
| Tests                                      | `app/docs/__test__/README.md`                            |
| Env, database, logging, gateways           | `app/docs/infra/README.md`                               |
| A decision already taken, or a pending one | `app/docs/decisions.md`                                  |
| Chain contracts                            | `app/contracts/*/README.md`                              |

## Definition of done for any task

1. Code on target, or legacy map updated if a module moved.
2. Tests in the right layer, protecting a named rule.
3. `yarn lint`, `yarn typecheck`, `yarn prettier:check`, `yarn test:unit` and `yarn test:integration` green.
4. Change class stated in the PR (additive, behavioral, breaking).
5. `app/docs/decisions.md` updated if anything in this file changed.
