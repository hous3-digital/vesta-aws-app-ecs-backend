CREATE TYPE "PayoutRequestStatus" AS ENUM (
    'REQUESTED', 'PROCESSING', 'SUBMITTED', 'CONFIRMED',
    'FAILED', 'UNKNOWN', 'REQUIRES_REVIEW'
);

CREATE TYPE "PayoutAttemptStatus" AS ENUM (
    'PROCESSING', 'CONFIRMED', 'FAILED', 'UNKNOWN'
);

ALTER TABLE "commission_ledger_entries"
    ADD COLUMN "payout_request_id" TEXT;

-- A prévia mensal da entrega 1 não representa mais uma reserva válida.
-- Os créditos continuam imutáveis; apenas voltam a ficar disponíveis para o
-- novo fluxo integral sob solicitação.
UPDATE "commission_ledger_entries"
SET "status" = 'AVAILABLE', "payout_cycle_id" = NULL
WHERE "status" = 'ALLOCATED' AND "payout_cycle_id" IS NOT NULL;

CREATE INDEX "commission_ledger_entries_payout_request_id_idx"
    ON "commission_ledger_entries"("payout_request_id");

CREATE TABLE "payout_requests" (
    "payout_request_id" TEXT NOT NULL,
    "issuer_external_id" TEXT NOT NULL,
    "active_issuer_external_id" TEXT,
    "organization_wallet_id" TEXT NOT NULL,
    "destination_address" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "settlement_asset_code" TEXT NOT NULL,
    "settlement_asset_issuer" TEXT,
    "settlement_amount_atomic" BIGINT NOT NULL,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotency_key_hash" TEXT NOT NULL,
    "on_chain_payout_id" TEXT NOT NULL,
    "stellar_tx_hash" TEXT,
    "stellar_ledger" INTEGER,
    "failure_code" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "processing_started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "payout_requests_payout_request_id_key" ON "payout_requests"("payout_request_id");
CREATE UNIQUE INDEX "payout_requests_active_issuer_external_id_key" ON "payout_requests"("active_issuer_external_id");
CREATE UNIQUE INDEX "payout_requests_on_chain_payout_id_key" ON "payout_requests"("on_chain_payout_id");
CREATE UNIQUE INDEX "payout_requests_stellar_tx_hash_key" ON "payout_requests"("stellar_tx_hash");
CREATE UNIQUE INDEX "payout_requests_issuer_external_id_idempotency_key_hash_key"
    ON "payout_requests"("issuer_external_id", "idempotency_key_hash");
CREATE INDEX "payout_requests_issuer_external_id_requested_at_idx"
    ON "payout_requests"("issuer_external_id", "requested_at");
CREATE INDEX "payout_requests_status_requested_at_idx"
    ON "payout_requests"("status", "requested_at");

CREATE TABLE "payout_attempts" (
    "payout_attempt_id" TEXT NOT NULL,
    "payout_request_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "status" "PayoutAttemptStatus" NOT NULL DEFAULT 'PROCESSING',
    "stellar_tx_hash" TEXT,
    "stellar_ledger" INTEGER,
    "failure_code" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "payout_attempts_payout_attempt_id_key" ON "payout_attempts"("payout_attempt_id");
CREATE UNIQUE INDEX "payout_attempts_payout_request_id_attempt_number_key"
    ON "payout_attempts"("payout_request_id", "attempt_number");
CREATE INDEX "payout_attempts_payout_request_id_idx" ON "payout_attempts"("payout_request_id");
