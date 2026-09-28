-- Renames one index of commission_ledger_entries to the name Prisma expects.
--
-- 20260810161000_add_commission_ledger_and_organization_wallet created it as
-- "commission_ledger_entries_issuer_external_id_status_available_at_idx", 68
-- characters. Postgres truncates identifiers at 63, so every environment holds
-- it as "..._available_a", while Prisma derives "..._availab_idx" from
-- schema.prisma and has reported the drift on every migrate dev since, folding
-- this rename into whatever migration came next. Split out here so each
-- migration keeps one concern.
--
-- A rename is catalog metadata only: no rewrite, no lock on the rows, no effect
-- on the running app, which never names an index. IF EXISTS keeps it a no-op on
-- a database that never had the truncated name. Safe to run twice.

ALTER INDEX IF EXISTS "commission_ledger_entries_issuer_external_id_status_available_a"
RENAME TO "commission_ledger_entries_issuer_external_id_status_availab_idx";
