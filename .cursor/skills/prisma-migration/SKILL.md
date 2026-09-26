---
name: prisma-migration
description: How to change the database schema without breaking staging, which applies migrations by itself on deploy - backwards-compatible SQL, the order schema, migration, mapper, entity, tests, the twin enum in the domain, backfills inside the migration, the review checklist of the generated SQL and what never to do. Use when a task adds or changes a Prisma model, a column, an enum or an index, or when a migration file is touched.
---

# Prisma migration

Applies `standard-module.mdc` (mapper field by field, twin enum in `domain/`, TypeID ids), `standard-chain.mdc` (`onChain*` columns are written only from a receipt, so they are always nullable) and rule 4 of `AGENTS.md` (PII exists in a column only as a hash). Read them first. `.cursor/hooks/guard-shell.js` denies the reset and bare-migrate forms in the "never" list below and asks before `db push` and `prisma:deploy`; the rest of that list is on you.

## Why every migration must be backwards compatible

`staging-workflow.yml` has a `migrate-database` job that runs `yarn prisma:deploy` **before** the new image is rolled out, and ECS keeps the old tasks alive until the new ones are healthy. For those minutes the previous version of the app runs against the new schema. Rolling the app back does not roll the schema back. So:

- The running version must keep working after the migration: nothing it reads disappears, nothing it writes becomes invalid.
- A change that the old code cannot survive (rename, drop, `NOT NULL` on a column it does not fill) is split in two releases: **expand** now, **contract** after the code that depended on the old shape is gone from prod.
- Prisma runs each migration in one transaction. `CREATE INDEX CONCURRENTLY` and using a new enum value in the same file are therefore impossible; tables are small today, a plain `CREATE INDEX` is fine, but say so in the header comment when the table is `credentials` or `attestation`.

## Order of work

Each step leaves `yarn typecheck` green, so run it after every one.

1. **Schema.** Edit `app/src/infra/database/@prisma/schema.prisma`: `@map` snake_case columns, `@@map` snake_case table, enum for a lifecycle, `@default` or `?` on every new column. Ids are TypeID strings with the module prefix.
2. **Migration file on the local database.** From `app/`: `yarn prisma:migrate:local --create-only --name {verb}_{object}` (`add_credential_expires_at`, `backfill_issuer_did`). It reads `.env.local` and writes `migrations/{timestamp}_{name}/migration.sql` without applying it, so the SQL can be edited before it is ever recorded in `_prisma_migrations`. A bare `prisma migrate dev` is denied by the hook because it reads `app/.env`, which is staging.
3. **Edit and apply the SQL.** Prisma writes the DDL only. Add the header comment saying what changes and why (`20260519000000_add_cpf_hash_to_credentials` and `20260810161000_add_commission_ledger_and_organization_wallet` show the shape), the backfill, and the guards from the checklist below. Then `yarn prisma:migrate:local` (no flags) applies it on the local database and `yarn prisma:gen` regenerates the client. Once applied, the file is frozen: a mistake becomes a new migration.
4. **Mapper.** `toDomain`, `toCreateInput`, `toUpdateInput` gain the field in the same position it has in the model. No spread.
5. **Entity.** The prop, the getter, the transition that sets it. A status enum that drives a rule gets its twin in `domain/` with the same values; the mapper converts. Never import a Prisma enum in `domain/` or `application/`.
6. **Tests.** Unit for the entity rule, integration for the handler rule, e2e when the HTTP contract changes. `yarn test:e2e` runs `migrate deploy` on `vesta_test` (created when missing, otherwise the pending migrations are applied on the existing data), which proves the migration applies on a database that is not the one it was written on; `yarn db:local` on a local database with rows is the proof of the backfill.
7. **Deploy checklist.** Every migration gets a row in `app/docs/deploy-checklist.md` in the same commit: staging applies it in CI, but prod has no migration job (`main-workflow.yml`), so someone runs `yarn prisma:deploy` against prod by hand before the merge, and the row is what schedules that. SUB-011 is the shape. Add to the row anything else the migration needs outside the repo (a long backfill run by hand, a new env var, a data fix first).

## Two-step patterns

| Change                         | Release N (expand)                                                                           | Release N+1 (contract)                                |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Rename a column                | Add the new column, backfill it in SQL, code writes both and reads the new one               | Drop the old column                                   |
| Make a column `NOT NULL`       | Add with a default, or nullable plus backfill; code always fills it                          | `ALTER COLUMN ... SET NOT NULL` after prod is clean   |
| Drop a column                  | Code stops reading and writing it                                                            | Drop it                                               |
| Change a column type           | New column with the new type, backfill, code switches                                        | Drop the old one                                      |
| Add an enum value              | `ALTER TYPE ... ADD VALUE IF NOT EXISTS`, twin enum in `domain/` gains the value             | nothing                                               |
| Remove or rename an enum value | Postgres cannot; add the new value, migrate rows in SQL, stop writing the old one            | Leave the dead value, document it in the twin enum    |
| Store a secret or an id key    | `SHA-256(value)` in a `*_hash` column plus a displayable prefix; the clear value never lands | Drop the clear column once every reader uses the hash |

## Review checklist of the generated SQL

Read `migration.sql` line by line before committing. All of these are blocking:

- Header comment says what changes and why; a backfill says why it is safe to run twice. Nine of the seventeen migrations in the folder have no header; new ones do.
- No `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN ... TYPE` or `RENAME` unless the row above in the two-step table says this is the contract release and the code that used the old shape is already in prod.
- Every new column is nullable or has a `DEFAULT`; `SET NOT NULL` appears only after the backfill in the same file, and only when the running app already fills the column.
- Backfills are idempotent: `ON CONFLICT ... DO NOTHING`, `WHERE column IS NULL`, `IF NOT EXISTS`. Reference shape: `20260706180000_backfill_missing_issuers` (`ON CONFLICT ("issuer_external_id") DO NOTHING`). Counter-example: the `did` backfill in `20260907120000_add_issuer_identity_did` has no `WHERE "did" IS NULL`, so a re-run would overwrite a DID set by hand.
- Enum values are added with `ADD VALUE IF NOT EXISTS` (`20260722000000_add_credential_pending_rejected`).
- `on_chain_*`, `*_tx_hash`, `*_ledger` columns are nullable with no default other than `NULL` (rule 3 of `AGENTS.md`).
- PII columns exist only as `*_hash` or `*_dedup_key` (rule 4); no column named `cpf`, `email` of an end user or `document` in clear.
- No literal secret or key material in a backfill.
- Indexes and constraints are named (`{table}_{column}_key`, `{table}_{column}_idx`) as Prisma names them, so the drift check stays clean.

## Never

- `yarn prisma:reset`, `prisma migrate reset`, `prisma db push`, `--force-reset`, `DROP`, `TRUNCATE` on anything but the local database through `make db-reset`. The hook denies the reset forms and asks before `db push`, because they read `app/.env`.
- Edit a migration that is already applied on staging. `migrate deploy` skips every name already recorded in `_prisma_migrations` without comparing checksums, so the edit silently never runs on staging or prod and the schema drifts with no error. Write a new migration that fixes the previous one.
- `prisma migrate resolve` on staging or prod without a dated line in `app/docs/decisions.md` saying what was marked and why.
- Generate a migration against staging (`prisma migrate dev` without `dotenv -e .env.local`).
- Hand-write the migration folder. The timestamp comes from Prisma so ordering never collides.

## First real use

This skill was written before the first schema change of release R4. The API-key hash of bug #357 (`task_01m37yf3j4esj953630bp08rby`) is the first migration that goes through it: an expand step (`key_hash` column plus `key_prefix`, backfilled from the clear key in SQL, guard reads the hash) and a later contract step that drops `key`. If that migration needs a manual adjustment the skill did not foresee, fix the skill in the same commit.
