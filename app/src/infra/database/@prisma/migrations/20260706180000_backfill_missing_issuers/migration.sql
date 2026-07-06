-- Backfill issuer metadata for credentials created before issuer provisioning
-- became mandatory. The migration is idempotent through the unique external ID.
INSERT INTO "issuer" (
  "issuer_id",
  "issuer_external_id",
  "name",
  "status",
  "public_key",
  "privy_enabled",
  "created_at"
)
SELECT
  'issuer_backfill_' || md5(credentials_by_issuer."issuer_id"),
  credentials_by_issuer."issuer_id",
  initcap(
    replace(
      regexp_replace(credentials_by_issuer."issuer_id", '_demo$', '', 'i'),
      '_',
      ' '
    )
  ),
  'active',
  NULL,
  false,
  credentials_by_issuer."first_credential_at"
FROM (
  SELECT
    "issuer_id",
    MIN("created_at") AS "first_credential_at"
  FROM "credentials"
  WHERE "issuer_id" IS NOT NULL
    AND btrim("issuer_id") <> ''
  GROUP BY "issuer_id"
) AS credentials_by_issuer
ON CONFLICT ("issuer_external_id") DO NOTHING;
