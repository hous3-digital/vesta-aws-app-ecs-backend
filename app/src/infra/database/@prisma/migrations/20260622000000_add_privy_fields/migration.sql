-- AlterTable: add Privy fields to credentials
ALTER TABLE "credentials" ADD COLUMN "user_wallet_address" TEXT;
ALTER TABLE "credentials" ADD COLUMN "privy_user_id" TEXT;

-- AlterTable: add user wallet attribution to attestations
ALTER TABLE "attestation" ADD COLUMN "user_wallet_address" TEXT;

-- AlterTable: add Privy feature flag to issuer
ALTER TABLE "issuer" ADD COLUMN "privy_enabled" BOOLEAN NOT NULL DEFAULT false;
