---
name: integration-testing
description: How to write a @integration spec for a handler, service, filter or guard that holds a rule, with makeSut and shared mocks, and when to skip it because the code is passthrough. Use when asked to test a handler or service, when a handler gains branching, or when fixing a bug found by QA.
---

# Integration testing

Applies `standard-test.mdc` (what is passthrough, `makeSut`, mocks convention, never assert repository reads) and `standard-code.mdc` (errors by class and code). Specs live in `__tests__/@integration/{handlers,services,controllers,http}/` and run with `yarn test:integration`. No database: every dependency is a mock from `__tests__/mocks/`.

## Write or skip

Write when the class has a rule: `if`/`switch`, validation, transformation, error mapping, an ordering decision. Skip when it only loads, calls and returns; `@e2e` covers that. A GET handler that calls a DAO and returns is always skipped: mocking the DAO tests the DAO.

Decision in one line: **can you name the rule?** If the `it` would be "calls saveOrThrow and returns", stop.

## Procedure

1. **Find the catalog row** in `app/docs/__test__/cenarios.md`. A `red` row means: write the spec first, see it fail, then fix the code in the same PR.
2. **Mocks first.** For every port the class injects, there is one file in `__tests__/mocks/{repository|gateway|service|cqrs}/` exporting `mock{Name}(): jest.Mocked<Port>` with every method stubbed to a sane default (`findByX` resolves `null`, `saveOrThrow` resolves its argument). Create the file if missing; never inline a partial mock in the spec. Entities for defaults come from `__tests__/mocks/model/{entity}.model.ts`, a `restoreWith(overrides)` around `Entity.restore`.
3. **`makeSut()`** at the top of the spec returns `{ sut, ...mocks }`. Instantiate the class directly with `new`; use `Test.createTestingModule` only when a Nest decorator matters (filters, guards with `Reflector`).
4. **One rule per `it`.** Override only the mock the case needs (`credentialRepository.findByVcHash.mockResolvedValue(revoked)`), act once, assert the outcome: the returned value, the error (`rejects.toMatchObject({ code })` or `rejects.toThrow(Class)`), or the write with the entity in its new state (`updateOrThrow` called with `expect.objectContaining({ status: "REVOKED" })`).
5. **Never assert** that a read was called, how many times, or with which arguments.
6. **Legacy services injected as concrete classes** (`WalletService`, `StellarService`) get a `mock{Name}Service()` in `mocks/service/` typed as `jest.Mocked<Pick<Class, "method">>` and cast at the constructor. Note the coupling in the spec header with the TD id (TD-002) so the mock disappears with the front.
7. Run the file alone, then `yarn lint` and `yarn prettier:check`.

## Shape

```ts
const makeSut = () => {
  const credentialRepository = mockCredentialRepository();
  const sut = new CredentialPublicRevokeHandler(credentialRepository);
  return { sut, credentialRepository };
};

it("CT-VESTA-CRED-011 rejects revoking a credential owned by another issuer", async () => {
  // Arrange
  const { sut, credentialRepository } = makeSut();
  credentialRepository.findByVcHash.mockResolvedValue(
    credentialModel({ issuerId: "issuer_other" }),
  );

  // Act
  const act = sut.execute(
    new CredentialPublicRevokeCommand("0xabc", "issuer_local_dev"),
  );

  // Assert
  await expect(act).rejects.toMatchObject({
    code: "CREDENTIAL_ISSUER_MISMATCH",
  });
});
```

## Refuse

- A spec for a passthrough handler, a DAO, a repository, a mapper or a gateway with a mocked SDK.
- A `jest.fn()` created inside a test for a port that has a mock file.
- `jest.spyOn` on the class under test to skip part of it: split the class instead.
