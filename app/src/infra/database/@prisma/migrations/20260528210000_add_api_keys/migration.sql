-- CreateTable
CREATE TABLE "api_keys" (
    "api_key_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3)
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_api_key_id_key" ON "api_keys"("api_key_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_key_active_idx" ON "api_keys"("key", "active");
