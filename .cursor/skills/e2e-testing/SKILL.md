---
name: e2e-testing
description: How to write a @e2e spec that locks an HTTP contract (route, auth, status, body shape, tenant isolation) against the app booted on the compose Postgres with Stellar mocked. Use when asked to cover a route, to lock /public/* before a refactor, or to reproduce a bug found by QA or a client.
---

# E2E testing

Applies `standard-test.mdc` (`createTestApp`, fixtures, cleanup, CT naming) and `AGENTS.md` (change classes: an e2e spec is the proof that `/public/*` did not change). Specs live in `__tests__/@e2e/{context}-{module}.spec.ts` and run with `yarn test:e2e`, which creates the `vesta_test` database, applies migrations, loads the local fixtures and boots the real `AppModule`.

## Prerequisites

- Postgres from `make up` reachable on localhost. `make env` creates `app/.env.test` from `.env.test.example` (own database, `VESTA_CONTRACT_ID=PLACEHOLDER` so the chain is mocked, real ZK).
- Fixture values are in `__tests__/constants`: issuer `local_bank`, the API key, the backoffice login, `verifier_local`.

## Procedure

1. **Pick the catalog rows** in `app/docs/__test__/cenarios.md` for the route. Each row is one `it`, named by the CT id. A `red` row is written before the fix.
2. **One file per context and module** (`public-credential.spec.ts`, `backoffice-auth.spec.ts`). `beforeAll` calls `createTestApp()` once; `afterAll` deletes what the file created through `testApp.prisma` and closes the app. Never truncate a table: other files share the database.
3. **Requests** go through `supertest` (`import request = require("supertest")`) with the real auth: `X-Api-Key` from constants for public routes, a token from `POST /backoffice/auth/login` for backoffice, `ADMIN_SECRET` from `process.env` for admin.
4. **Bodies** come from `__tests__/@e2e/fixtures/{module}-api.fixture.ts`: static functions with `faker` for text and `generateCpf()` for CPFs, accepting `overrides`.
5. **Assert the contract**, not the implementation: status, the fields the client reads (`body.data.vcHash`), the error `code` on failures, and that a field must NOT be there (PII). Read the database only to prove storage rules (CT-VESTA-CRED-007).
6. **Tenant isolation** cases create the resource with issuer A and read it with issuer B: assert 403 or 404 and an empty list. This is the only layer that proves it.
7. **Proof routes** (`/public/proof/*`) generate a real Groth16 proof: their file sets `jest.setTimeout(120_000)` and stays separate so the fast files stay fast.
8. Run the file alone: `yarn test:e2e` runs everything; for one file use `npx dotenv -e .env.test -- npx jest --config config/jest-e2e.config.ts --runInBand __tests__/@e2e/{file}`.

## Shape

```ts
describe("/public/credential", () => {
  let testApp: TestApp;
  const issuedVcHashes: string[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.prisma.credential.deleteMany({
      where: { vcHash: { in: issuedVcHashes } },
    });
    await testApp.close();
  });

  it("CT-VESTA-CRED-003 issuing the same CPF twice returns 409 CPF_ALREADY_REGISTERED", async () => {
    // Arrange
    const body = CredentialApiFixture.issue();
    const first = await api()
      .post("/public/credential")
      .set("X-Api-Key", FIXTURE_API_KEY)
      .send(body);
    issuedVcHashes.push(first.body.data.vcHash);

    // Act
    const second = await api()
      .post("/public/credential")
      .set("X-Api-Key", FIXTURE_API_KEY)
      .send(body);

    // Assert
    expect(second.status).toBe(409);
    expect(JSON.stringify(second.body)).toContain("CPF_ALREADY_REGISTERED");
  });
});
```

## Refuse

- A spec that mocks a provider inside the app (`overrideProvider`) to reach a branch: that case belongs to `@integration`.
- Asserting the full response body with `toEqual`: new optional fields are additive and must not break the suite. Assert the fields the client depends on.
- Pointing `.env.test` at anything but localhost. `config/e2e-prepare.ts` refuses it, do not work around it.
