ALTER TABLE "organization_wallets"
ADD COLUMN "control_verified_at" TIMESTAMP(3),
ADD COLUMN "control_verified_by_user_id" TEXT,
ADD COLUMN "trustline_verified_at" TIMESTAMP(3);
