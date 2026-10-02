-- add_prepare_sessions (task 3 of prd-reliable-operation, F4-002 / TD-020)
--
-- The session between POST /public/proof/prepare and /submit-signed lived in process memory
-- when REDIS_URL was not set, which is every deployed environment: a second container or a
-- restart between the two calls lost it. The session now lives here, keyed by the SHA-256 of
-- the bearer id the SDK receives (the clear id never lands), with the payload submit-signed
-- reads and the expiry the store sweeps on every write. Same shape as auth_challenges.
-- Expansion only: nothing existing changes, no contraction step follows. Safe to run twice.

CREATE TABLE IF NOT EXISTS "prepare_sessions" (
    "session_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "prepare_sessions_session_hash_key" ON "prepare_sessions"("session_hash");

CREATE INDEX IF NOT EXISTS "prepare_sessions_expires_at_idx" ON "prepare_sessions"("expires_at");
