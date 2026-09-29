-- Expansion step for API keys stored as a hash (SEC-004 #357, TD-005).
--
-- What changes: "key" becomes nullable; "key_hash" (SHA-256 hex of the clear key,
-- unique), "key_prefix" (the first 19 characters, "vesta_live_" plus 8 hex, the
-- only part ever displayed again) and "expires_at" (rotation grace) are added, all
-- nullable. Nothing is dropped and nothing gains NOT NULL: the version of the app
-- running during the rollout still reads and writes "key", and this file must not
-- break it. The clear column is dropped in the contraction release, once every
-- reader uses "key_hash".
--
-- Backfill: every existing row gets its hash and prefix computed in SQL with the
-- sha256() built into Postgres 11+, so no key created before this release has to
-- be reissued. Safe to run twice: the WHERE only touches rows whose hash is still
-- null, and a row without a clear key is left alone. No key material appears in
-- this file.
--
-- Index: api_keys is small, so a plain CREATE INDEX inside the migration
-- transaction is fine. Named as Prisma names it so the drift check stays clean.

ALTER TABLE "api_keys"
ADD COLUMN "expires_at" TIMESTAMP(3),
ADD COLUMN "key_hash" TEXT,
ADD COLUMN "key_prefix" TEXT,
ALTER COLUMN "key" DROP NOT NULL;

UPDATE "api_keys"
SET "key_hash" = encode(sha256(convert_to("key", 'UTF8')), 'hex'),
    "key_prefix" = left("key", 19)
WHERE "key_hash" IS NULL
  AND "key" IS NOT NULL;

CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
