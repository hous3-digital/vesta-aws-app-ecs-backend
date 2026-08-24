CREATE TABLE "auth_challenges" (
    "challenge_hash" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "auth_challenges_challenge_hash_key" ON "auth_challenges"("challenge_hash");
CREATE INDEX "auth_challenges_expires_at_idx" ON "auth_challenges"("expires_at");
