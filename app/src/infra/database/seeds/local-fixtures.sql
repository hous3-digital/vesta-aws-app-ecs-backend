-- Development fixtures. NEVER runs in production.
-- Backoffice password (plain text): vesta_local
-- SDK API key: vesta_live_local_dev_do_not_use_in_production
-- Login: dev@localhost / vesta_local
-- External issuer id: local_bank
-- Verifier: verifier_local

INSERT INTO "issuer" (
  "issuer_id",
  "issuer_external_id",
  "name",
  "status",
  "privy_enabled",
  "roles",
  "authorized_credential_types",
  "registry_status",
  "created_at"
) VALUES (
  'issuer_local_dev',
  'local_bank',
  'Banco Local Dev',
  'active',
  false,
  ARRAY['TECHNICAL', 'COMMERCIAL']::"IssuerRole"[],
  ARRAY['VestaKYCCredential']::TEXT[],
  'UNREGISTERED',
  NOW()
)
ON CONFLICT ("issuer_external_id") DO NOTHING;

INSERT INTO "api_keys" (
  "api_key_id",
  "issuer_external_id",
  "key",
  "name",
  "active",
  "created_at"
) VALUES (
  'ak_local_dev',
  'local_bank',
  'vesta_live_local_dev_do_not_use_in_production',
  'Local SDK',
  true,
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "backoffice_users" (
  "backoffice_user_id",
  "issuer_external_id",
  "email",
  "password_hash",
  "name",
  "active",
  "created_at",
  "updated_at"
) VALUES (
  'bo_local_dev',
  'local_bank',
  'dev@localhost',
  '$2b$10$Zt5v2kkMsU3dGrLQgZWWneFjQx5CwvWSJe3ZyNWOxPtChMGNmGx4G',
  'Dev Local',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "verifier" (
  "verifier_id",
  "name",
  "status",
  "created_at",
  "updated_at"
) VALUES (
  'verifier_local',
  'Verifier Local',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT ("verifier_id") DO NOTHING;
