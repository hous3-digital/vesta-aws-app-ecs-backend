import request = require("supertest");
import { AdminApiFixture } from "@test/@e2e/fixtures/admin-api.fixture";
import type { TestApp } from "@test/helpers/create-test-app.helper";
import { loginBackoffice } from "@test/helpers/backoffice-login.helper";

/** A second issuer with its own backoffice user and API key, for tenant isolation cases. */
export interface TestTenant {
  /** External issuer id (the tenant key used by API keys, backoffice users and credentials). */
  issuerId: string;
  email: string;
  password: string;
  backofficeUserId: string;
  apiKey: string;
  apiKeyId: string;
  /** Bearer token of the tenant's backoffice user. */
  token: string;
}

/** The admin secret the booted app validates, loaded from .env.test by config/test-setup.ts. */
export function adminSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("ADMIN_SECRET is not set in .env.test");
  return secret;
}

/** Creates an issuer, a backoffice user and an API key through the admin routes, then logs the user in. */
export async function createTestTenant(testApp: TestApp): Promise<TestTenant> {
  const post = (route: string) => request(testApp.app.getHttpServer()).post(route).set("X-Admin-Secret", adminSecret());

  const issuer = await post("/admin/issuers").send(AdminApiFixture.createIssuer());
  expectCreated(issuer, "/admin/issuers");
  const issuerId = issuer.body.data.issuerId as string;

  const userBody = AdminApiFixture.createBackofficeUser(issuerId);
  const user = await post("/admin/backoffice-users").send(userBody);
  expectCreated(user, "/admin/backoffice-users");

  const apiKey = await post("/admin/api-keys").send(AdminApiFixture.createApiKey(issuerId));
  expectCreated(apiKey, "/admin/api-keys");

  const email = String(userBody.email);
  const password = String(userBody.password);
  return {
    issuerId,
    email,
    password,
    backofficeUserId: user.body.data.backofficeUser.id as string,
    apiKey: apiKey.body.data.key as string,
    apiKeyId: apiKey.body.data.id as string,
    token: await loginBackoffice(testApp, email, password),
  };
}

/** Removes every row the tenant owns, in dependency order. Safe to call for an issuer that never existed. */
export async function deleteTestTenant(testApp: TestApp, issuerId: string): Promise<void> {
  const prisma = testApp.prisma;
  const credentials = await prisma.credential.findMany({ where: { issuerId }, select: { vcHash: true } });
  const vcHashes = credentials.map((credential) => credential.vcHash);
  const payouts = await prisma.payoutRequest.findMany({ where: { issuerId }, select: { id: true } });

  await prisma.payoutAttempt.deleteMany({ where: { payoutRequestId: { in: payouts.map((payout) => payout.id) } } });
  await prisma.payoutRequest.deleteMany({ where: { issuerId } });
  await prisma.commissionLedgerEntry.deleteMany({ where: { issuerId } });
  await prisma.attestation.deleteMany({ where: { vcHash: { in: vcHashes } } });
  await prisma.credential.deleteMany({ where: { issuerId } });
  await prisma.apiKey.deleteMany({ where: { issuerId } });
  await prisma.backofficeUser.deleteMany({ where: { issuerId } });
  await prisma.organizationWallet.deleteMany({ where: { issuerId } });
  await prisma.issuer.deleteMany({ where: { issuerId } });
}

function expectCreated(response: request.Response, route: string): void {
  if (response.status !== 201) {
    throw new Error(`${route} answered ${response.status} while building the test tenant`);
  }
}
