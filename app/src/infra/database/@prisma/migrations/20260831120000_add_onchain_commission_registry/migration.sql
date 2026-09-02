CREATE TYPE "CommissionOnChainStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'CONFIRMED',
  'UNKNOWN',
  'REQUIRES_REVIEW',
  'NOT_APPLICABLE'
);

ALTER TABLE "commission_ledger_entries"
  ADD COLUMN "on_chain_credit_id" TEXT,
  ADD COLUMN "on_chain_beneficiary_id" TEXT,
  ADD COLUMN "on_chain_amount_atomic" BIGINT,
  ADD COLUMN "on_chain_status" "CommissionOnChainStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "on_chain_tx_hash" TEXT,
  ADD COLUMN "on_chain_ledger" INTEGER,
  ADD COLUMN "on_chain_credited_at" TIMESTAMP(3),
  ADD COLUMN "on_chain_failure_code" TEXT,
  ADD COLUMN "on_chain_updated_at" TIMESTAMP(3);

-- Entries already paid by the v1 vault must not be credited again: that
-- transfer happened before the vault kept beneficiary balances.
UPDATE "commission_ledger_entries"
SET "on_chain_status" = 'NOT_APPLICABLE'
WHERE "status" IN ('SETTLED', 'REVERSED');

ALTER TABLE "payout_requests"
  ADD COLUMN "on_chain_beneficiary_id" TEXT;

CREATE UNIQUE INDEX "commission_ledger_entries_on_chain_credit_id_key"
  ON "commission_ledger_entries"("on_chain_credit_id");
CREATE UNIQUE INDEX "commission_ledger_entries_on_chain_tx_hash_key"
  ON "commission_ledger_entries"("on_chain_tx_hash");
CREATE INDEX "commission_ledger_entries_on_chain_status_created_at_idx"
  ON "commission_ledger_entries"("on_chain_status", "created_at");
