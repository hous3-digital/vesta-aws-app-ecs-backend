-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "nullifier" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "kyc_provider" TEXT NOT NULL,
    "kyc_approved" BOOLEAN NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "vc_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingress" (
    "ingress_id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingress_pkey" PRIMARY KEY ("ingress_id")
);

-- CreateTable
CREATE TABLE "egress" (
    "egress_id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "egress_pkey" PRIMARY KEY ("egress_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credentials_nullifier_key" ON "credentials"("nullifier");

-- CreateIndex
CREATE INDEX "credentials_status_idx" ON "credentials"("status");

-- CreateIndex
CREATE INDEX "credentials_kyc_provider_idx" ON "credentials"("kyc_provider");
