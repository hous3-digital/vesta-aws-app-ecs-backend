-- Link API keys to issuers and add backoffice users for authenticated dashboard access.

ALTER TABLE "api_keys"
ADD COLUMN "issuer_external_id" TEXT;

UPDATE "api_keys"
SET "issuer_external_id" = (
    SELECT "issuer_external_id"
    FROM "issuer"
    ORDER BY "created_at" ASC
    LIMIT 1
)
WHERE "issuer_external_id" IS NULL
  AND EXISTS (SELECT 1 FROM "issuer");

CREATE INDEX "api_keys_issuer_external_id_idx" ON "api_keys"("issuer_external_id");

CREATE TABLE "backoffice_users" (
    "backoffice_user_id" TEXT NOT NULL,
    "issuer_external_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "backoffice_users_backoffice_user_id_key" ON "backoffice_users"("backoffice_user_id");
CREATE UNIQUE INDEX "backoffice_users_email_key" ON "backoffice_users"("email");
CREATE INDEX "backoffice_users_issuer_external_id_idx" ON "backoffice_users"("issuer_external_id");
