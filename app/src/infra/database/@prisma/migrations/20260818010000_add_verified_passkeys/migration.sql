CREATE TABLE "passkey_credentials" (
    "passkey_credential_id" TEXT NOT NULL,
    "vc_hash" TEXT NOT NULL,
    "issuer_external_id" TEXT NOT NULL,
    "subject_did" TEXT NOT NULL,
    "public_key_base64url" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" JSONB,
    "device_type" TEXT NOT NULL,
    "backed_up" BOOLEAN NOT NULL DEFAULT false,
    "rp_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "passkey_credentials_passkey_credential_id_key"
    ON "passkey_credentials"("passkey_credential_id");
CREATE UNIQUE INDEX "passkey_credentials_vc_hash_key"
    ON "passkey_credentials"("vc_hash");
CREATE INDEX "passkey_credentials_issuer_external_id_idx"
    ON "passkey_credentials"("issuer_external_id");
CREATE INDEX "passkey_credentials_subject_did_idx"
    ON "passkey_credentials"("subject_did");
