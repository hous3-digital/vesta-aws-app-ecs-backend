-- Add PENDING and REJECTED to CredentialStatus enum for async KYC flow.
ALTER TYPE "CredentialStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "CredentialStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
