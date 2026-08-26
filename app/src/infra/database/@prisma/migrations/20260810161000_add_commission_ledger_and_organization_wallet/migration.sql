-- Delivery 1: immutable commission ledger and issuer-owned Stellar wallets.
-- Existing attestations are intentionally not backfilled: commissions start
-- only after this migration is deployed.

CREATE TYPE "CommissionEntryType" AS ENUM ('ACCRUAL', 'REVERSAL');
CREATE TYPE "CommissionEntryStatus" AS ENUM ('PENDING_SECURITY', 'AVAILABLE', 'ALLOCATED', 'SETTLED', 'REVERSED');
CREATE TYPE "PayoutCycleStatus" AS ENUM ('PREVIEW');
CREATE TYPE "OrganizationWalletStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'SUSPENDED');

ALTER TABLE "attestation" ADD COLUMN "issuer_external_id" TEXT;
CREATE INDEX "attestation_issuer_external_id_idx" ON "attestation"("issuer_external_id");

CREATE TABLE "commission_ledger_entries" (
  "commission_entry_id" TEXT NOT NULL,
  "issuer_external_id" TEXT NOT NULL,
  "attestation_id" TEXT,
  "entry_type" "CommissionEntryType" NOT NULL DEFAULT 'ACCRUAL',
  "status" "CommissionEntryStatus" NOT NULL DEFAULT 'PENDING_SECURITY',
  "amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "source" TEXT NOT NULL DEFAULT 'ATTESTATION_REUSE',
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "available_at" TIMESTAMP(3) NOT NULL,
  "payout_cycle_id" TEXT,
  "settled_at" TIMESTAMP(3),
  "reversal_of_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "commission_ledger_entries_commission_entry_id_key" ON "commission_ledger_entries"("commission_entry_id");
CREATE UNIQUE INDEX "commission_ledger_entries_attestation_id_key" ON "commission_ledger_entries"("attestation_id");
CREATE INDEX "commission_ledger_entries_issuer_external_id_status_available_at_idx" ON "commission_ledger_entries"("issuer_external_id", "status", "available_at");
CREATE INDEX "commission_ledger_entries_payout_cycle_id_idx" ON "commission_ledger_entries"("payout_cycle_id");

CREATE TABLE "payout_cycles" (
  "payout_cycle_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "cutoff_at" TIMESTAMP(3) NOT NULL,
  "status" "PayoutCycleStatus" NOT NULL DEFAULT 'PREVIEW',
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "payout_cycles_payout_cycle_id_key" ON "payout_cycles"("payout_cycle_id");
CREATE UNIQUE INDEX "payout_cycles_period_start_period_end_cutoff_at_key" ON "payout_cycles"("period_start", "period_end", "cutoff_at");

CREATE TABLE "payout_cycle_items" (
  "payout_cycle_item_id" TEXT NOT NULL,
  "payout_cycle_id" TEXT NOT NULL,
  "issuer_external_id" TEXT NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "entries_count" INTEGER NOT NULL,
  "entry_ids" JSONB NOT NULL,
  "blocked_reason" TEXT,
  "wallet_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "payout_cycle_items_payout_cycle_item_id_key" ON "payout_cycle_items"("payout_cycle_item_id");
CREATE UNIQUE INDEX "payout_cycle_items_payout_cycle_id_issuer_external_id_key" ON "payout_cycle_items"("payout_cycle_id", "issuer_external_id");
CREATE INDEX "payout_cycle_items_issuer_external_id_idx" ON "payout_cycle_items"("issuer_external_id");

CREATE TABLE "organization_wallets" (
  "organization_wallet_id" TEXT NOT NULL,
  "issuer_external_id" TEXT NOT NULL,
  "privy_user_id" TEXT,
  "privy_wallet_id" TEXT,
  "stellar_address" TEXT,
  "network" TEXT NOT NULL,
  "status" "OrganizationWalletStatus" NOT NULL DEFAULT 'PENDING',
  "account_activated" BOOLEAN NOT NULL DEFAULT false,
  "trustline_ready" BOOLEAN NOT NULL DEFAULT false,
  "asset_code" TEXT NOT NULL,
  "asset_issuer" TEXT,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "organization_wallets_organization_wallet_id_key" ON "organization_wallets"("organization_wallet_id");
CREATE UNIQUE INDEX "organization_wallets_issuer_external_id_key" ON "organization_wallets"("issuer_external_id");
CREATE UNIQUE INDEX "organization_wallets_privy_user_id_key" ON "organization_wallets"("privy_user_id");
CREATE UNIQUE INDEX "organization_wallets_stellar_address_key" ON "organization_wallets"("stellar_address");
CREATE INDEX "organization_wallets_status_idx" ON "organization_wallets"("status");
