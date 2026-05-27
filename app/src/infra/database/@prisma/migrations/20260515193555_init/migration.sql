-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "credentials" (
    "credential_id" TEXT NOT NULL,
    "nullifier" TEXT,
    "issuer" TEXT,
    "kyc_provider" TEXT,
    "kyc_approved" BOOLEAN,
    "issued_at" TIMESTAMP(3),
    "vc_hash" TEXT NOT NULL,
    "issuer_did" TEXT NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "subject_did" TEXT NOT NULL,
    "kyc_level" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "soroban_tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "attestation" (
    "attestation_id" TEXT NOT NULL,
    "vc_hash" TEXT NOT NULL,
    "proof_hash" TEXT NOT NULL,
    "verifier_id" TEXT NOT NULL,
    "kyc_level" TEXT NOT NULL,
    "soroban_tx_hash" TEXT,
    "soroban_ledger" INTEGER,
    "on_chain_result" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "issuer" (
    "issuer_id" TEXT NOT NULL,
    "issuer_external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "public_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "ingress" (
    "ingress_id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL
);

-- CreateTable
CREATE TABLE "egress" (
    "egress_id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "credentials_credential_id_key" ON "credentials"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_nullifier_key" ON "credentials"("nullifier");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_vc_hash_key" ON "credentials"("vc_hash");

-- CreateIndex
CREATE INDEX "credentials_status_idx" ON "credentials"("status");

-- CreateIndex
CREATE INDEX "credentials_kyc_provider_idx" ON "credentials"("kyc_provider");

-- CreateIndex
CREATE UNIQUE INDEX "attestation_attestation_id_key" ON "attestation"("attestation_id");

-- CreateIndex
CREATE INDEX "attestation_vc_hash_idx" ON "attestation"("vc_hash");

-- CreateIndex
CREATE UNIQUE INDEX "issuer_issuer_id_key" ON "issuer"("issuer_id");

-- CreateIndex
CREATE UNIQUE INDEX "issuer_issuer_external_id_key" ON "issuer"("issuer_external_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingress_ingress_id_key" ON "ingress"("ingress_id");

-- CreateIndex
CREATE UNIQUE INDEX "egress_egress_id_key" ON "egress"("egress_id");
