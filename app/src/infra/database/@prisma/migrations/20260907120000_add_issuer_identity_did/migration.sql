-- Additive issuer identity model. Internal issuer_external_id values remain
-- untouched because API-key scope and existing relations still depend on them.
CREATE TYPE "IssuerRole" AS ENUM ('TECHNICAL', 'COMMERCIAL');
CREATE TYPE "IssuerRegistryStatus" AS ENUM ('UNREGISTERED', 'REGISTERED', 'SUSPENDED');

ALTER TABLE "issuer"
ADD COLUMN "did" TEXT,
ADD COLUMN "roles" "IssuerRole"[] NOT NULL DEFAULT ARRAY[]::"IssuerRole"[],
ADD COLUMN "authorized_credential_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "registry_status" "IssuerRegistryStatus" NOT NULL DEFAULT 'UNREGISTERED';

CREATE UNIQUE INDEX "issuer_did_key" ON "issuer"("did");

-- An issuer that already originated a Vesta KYC credential is known to have
-- handled this credential type. Its commercial/technical role is deliberately
-- not inferred because the legacy model conflated those concepts.
UPDATE "issuer" AS i
SET "authorized_credential_types" = ARRAY['VestaKYCCredential']::TEXT[]
WHERE EXISTS (
  SELECT 1
  FROM "credentials" AS c
  WHERE c."issuer_id" = i."issuer_external_id"
);

-- Reuse an existing public organization address as the initial controller DID
-- only when both the address shape and a supported public network are known.
-- Rows without enough evidence remain nullable and continue through the legacy
-- compatibility path until they are configured operationally.
UPDATE "issuer" AS i
SET "did" =
  'did:pkh:stellar:' ||
  CASE w."network"
    WHEN 'mainnet' THEN 'pubnet'
    WHEN 'testnet' THEN 'testnet'
  END ||
  ':' || w."stellar_address"
FROM "organization_wallets" AS w
WHERE w."issuer_external_id" = i."issuer_external_id"
  AND w."network" IN ('mainnet', 'testnet')
  AND w."stellar_address" ~ '^G[A-Z2-7]{55}$';
