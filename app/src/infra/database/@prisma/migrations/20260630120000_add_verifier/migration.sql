-- CreateTable: verifier (parceiros consumidores de credenciais, ex: Vulpay)
CREATE TABLE "verifier" (
    "verifier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "verifier_verifier_id_key" ON "verifier"("verifier_id");
