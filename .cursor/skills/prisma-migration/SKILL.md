---
name: prisma-migration
description: How to change the database schema without breaking staging, which applies migrations by itself on deploy - backwards-compatible SQL, the order schema, migration, mapper, entity, tests, the twin enum in the domain, backfills inside the migration, the review checklist of the generated SQL and what never to do. Use when a task adds or changes a Prisma model, a column, an enum or an index, or when a migration file is touched.
---

# Prisma migration

Applies `standard-module.mdc` (mapper field by field, twin enum in `domain/`, TypeID ids), `standard-chain.mdc` (`onChain*` columns are written only from a receipt, so they are always nullable) and rule 4 of `AGENTS.md` (PII exists in a column only as a hash). Read them first. The hooks in `.cursor/hooks/guard-shell.js` enforce the "never" list below; do not look for a way around them.

## Why every migration must be backwards compatible

`staging-workflow.yml` has a `migrate-database` job that runs `yarn prisma:deploy` **before** the new image is rolled out, and ECS keeps the old tasks alive until the new ones are healthy. For those minutes the previous version of the app runs against the new schema. Rolling the app back does not roll the schema back. So:

- The running version must keep working after the migration: nothing it reads disappears, nothing it writes becomes invalid.
- A change that the old code cannot survive (rename, drop, `NOT NULL` on a column it does not fill) is split in two releases: **expand** now, **contract** after the code that depended on the old shape is gone from prod.
- Prisma runs each migration in one transaction. `CREATE INDEX CONCURRENTLY` and using a new enum value in the same file are therefore impossible; tables are small today, a plain `CREATE INDEX` is fine, but say so in the header comment when the table is `credentials` or `attestation`.

## Order of work

Each step leaves `yarn typecheck` green, so run it after every one.

1. **Schema.** Edit `app/src/infra/database/@prisma/schema.prisma`: `@map` snake_case columns, `@@map` snake_case table, enum for a lifecycle, `@default` or `?` on every new column. Ids are TypeID strings with the module prefix.
2. **Migration on the local database.** From `app/`: `yarn prisma:migrate:local --name {verb}_{object}` (`add_credential_expires_at`, `backfill_issuer_did`). It reads `.env.local`, creates `migrations/{timestamp}_{name}/migration.sql` and applies it. A bare `prisma migrate dev` is denied by the hook because it reads `app/.env`, which is staging.
3. **Edit the SQL.** Prisma writes the DDL only. Add the header comment saying why (every migration in the folder has one), the backfill, and the guards from the checklist below. Re-apply with `yarn db:local` (it runs `migrate deploy`, so an edited but unapplied migration is picked up) and confirm with `yarn prisma:gen`.
4. **Mapper.** `toDomain`, `toCreateInput`, `toUpdateInput` gain the field in the same position it has in the model. No spread.
5. **Entity.** The prop, the getter, the transition that sets it. A status enum that drives a rule gets its twin in `domain/` with the same values; the mapper converts. Never import a Prisma enum in `domain/` or `application/`.
6. **Tests.** Unit for the entity rule, integration for the handler rule, e2e when the HTTP contract changes. `yarn test:e2e` migrates `vesta_test` from scratch, which is the proof that the migration applies on an empty database; `yarn db:local` on a database that already has data is the proof of the backfill.
7. **Deploy checklist.** A migration that needs anything outside the repo (a long backfill run by hand, a new env var, a data fix on prod first) gets a row in `app/docs/deploy-checklist.md` in the same commit. A migration that is applied by CI alone needs no row.

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

- Header comment says what changes and why; a backfill says why it is safe to run twice.
- No `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN ... TYPE` or `RENAME` unless the row above in the two-step table says this is the contract release and the code that used the old shape is already in prod.
- Every new column is nullable or has a `DEFAULT`; `SET NOT NULL` appears only after the backfill in the same file, and only when the running app already fills the column.
- Backfills are idempotent: `ON CONFLICT ... DO NOTHING`, `WHERE column IS NULL`, `IF NOT EXISTS`. Reference shapes: `20260706180000_backfill_missing_issuers` and `20260907120000_add_issuer_identity_did`.
- Enum values are added with `ADD VALUE IF NOT EXISTS` (`20260722000000_add_credential_pending_rejected`).
- `on_chain_*`, `*_tx_hash`, `*_ledger` columns are nullable with no default other than `NULL` (rule 3 of `AGENTS.md`).
- PII columns exist only as `*_hash` or `*_dedup_key` (rule 4); no column named `cpf`, `email` of an end user or `document` in clear.
- No literal secret or key material in a backfill.
- Indexes and constraints are named (`{table}_{column}_key`, `{table}_{column}_idx`) as Prisma names them, so the drift check stays clean.

## Never

- `yarn prisma:reset`, `prisma migrate reset`, `prisma db push`, `--force-reset`, `DROP`, `TRUNCATE` on anything but the local database through `make db-reset`. The hook denies the other forms because they read `app/.env`.
- Edit a migration that is already applied on staging. Prisma stores a checksum; `migrate deploy` fails and the deploy stops. Write a new migration that fixes the previous one.
- `prisma migrate resolve` on staging or prod without a dated line in `app/docs/decisions.md` saying what was marked and why.
- Generate a migration against staging (`prisma migrate dev` without `dotenv -e .env.local`).
- Hand-write the migration folder. The timestamp comes from Prisma so ordering never collides.

## First real use

This skill was written before the first schema change of release R4. The API-key hash of bug #357 (`task_01m37yf3j4esj953630bp08rby`) is the first migration that goes through it: an expand step (`key_hash` column plus `key_prefix`, backfilled from the clear key in SQL, guard reads the hash) and a later contract step that drops `key`. If that migration needs a manual adjustment the skill did not foresee, fix the skill in the same commit.
