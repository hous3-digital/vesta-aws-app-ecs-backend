# Tech spec: [feature name]

PRD: `tasks/prd-[slug]/prd.md`

## Summary

[Two paragraphs: the approach and the main decisions. Which modules change, which are born on target, which legacy files move (legacy map in `AGENTS.md`).]

## Modules and files

| Module | State today (legacy map) | What changes | Files |
| ------ | ------------------------ | ------------ | ----- |

## Domain

- Entities and value objects: [new props, transitions, `DomainError` codes]
- Events published: [`{Aggregate}{PastTense}Event` and who consumes]

## Application

| Use case | Kind (command/query) | Handler | Input | Result |
| -------- | -------------------- | ------- | ----- | ------ |

## Infra

- Schema: [models, columns, enums; the migration follows the `prisma-migration` skill; two-step changes named]
- Gateways and ports: [chain calls behind which port; `chain-gateway` skill]
- Env vars: [new variables in `env.schema.ts` and `.env.local.example`]

## API

| Method and path | Context (public/backoffice/admin) | Auth pairing | Change class |
| --------------- | --------------------------------- | ------------ | ------------ |

## Tests

- `@unit`: [entity rules]
- `@integration`: [handler rules, with the mock files they need]
- `@e2e`: [CT ids from `app/docs/__test__/cenarios.md`]

## Standards

Rules that apply and any deviation with its reason: `standard-module`, `standard-code`, `standard-test`, `standard-chain`, `standard-security`.

## Outside the repo

Rows that go to `app/docs/deploy-checklist.md`: [env, secret, migration on prod, data fix, contract, ZK artifact]. "None" is a valid answer.

## Risks

- [Risk] · mitigation
