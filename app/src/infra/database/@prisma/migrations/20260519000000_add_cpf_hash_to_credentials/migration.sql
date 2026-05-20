-- Add cpf_dedup_key column to credentials table for duplicate CPF detection.
--
-- Stores HMAC-SHA256(CPF_HMAC_SECRET, cpf) — NOT the CPF itself, NOT the
-- Poseidon hash from the VC. The server secret makes brute-force infeasible
-- even if the database is compromised.
--
-- Nullable for backward compatibility with existing rows.
-- Partial unique index: multiple NULLs are allowed; non-null values must be unique.

ALTER TABLE "credentials" ADD COLUMN "cpf_dedup_key" TEXT;

CREATE UNIQUE INDEX "credentials_cpf_dedup_key_key" ON "credentials"("cpf_dedup_key") WHERE "cpf_dedup_key" IS NOT NULL;
