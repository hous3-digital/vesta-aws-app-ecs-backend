ALTER TABLE "attestation"
  ADD COLUMN "issuer_did" TEXT;

ALTER TABLE "issuer"
  ADD COLUMN "registry_transaction_hash" TEXT,
  ADD COLUMN "registry_ledger" INTEGER,
  ADD COLUMN "registry_confirmed_at" TIMESTAMP(3);

UPDATE "attestation" AS "attestation_record"
SET "issuer_did" = "issuer_record"."did"
FROM "issuer" AS "issuer_record"
WHERE "attestation_record"."issuer_external_id" = "issuer_record"."issuer_external_id"
  AND "issuer_record"."did" IS NOT NULL;

CREATE INDEX "attestation_issuer_did_idx" ON "attestation"("issuer_did");
