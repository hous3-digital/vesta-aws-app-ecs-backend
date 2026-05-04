-- CreateTable
CREATE TABLE "user" (
    "user_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "role" (
    "role_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "membership" (
    "membership_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deactivated_at" TIMESTAMP(3),
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "file" (
    "file_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deactivated_at" TIMESTAMP(3),
    "processing_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "reproved_at" TIMESTAMP(3),
    "reason" TEXT,
    "parent_id" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ingress" (
    "ingress_id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL
);

-- CreateTable
CREATE TABLE "egress" (
    "egress_id" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "response" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "user_user_id_key" ON "user"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_role_id_key" ON "role"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_type_key" ON "role"("type");

-- CreateIndex
CREATE UNIQUE INDEX "membership_membership_id_key" ON "membership"("membership_id");

-- CreateIndex
CREATE INDEX "membership_user_id_idx" ON "membership"("user_id");

-- CreateIndex
CREATE INDEX "membership_role_id_idx" ON "membership"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_file_id_key" ON "file"("file_id");

-- CreateIndex
CREATE INDEX "file_parent_id_idx" ON "file"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingress_ingress_id_key" ON "ingress"("ingress_id");

-- CreateIndex
CREATE UNIQUE INDEX "egress_egress_id_key" ON "egress"("egress_id");
