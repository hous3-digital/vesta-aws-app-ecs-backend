---
name: unit-testing
description: How to write a @unit spec for an entity, value object, codec, builder or formatter, and how to refuse a unit test for anything else. Use when asked to test an entity or value object, to add unit tests, or when a new domain rule is written.
---

# Unit testing

Applies `standard-test.mdc` (tree, naming, AAA, no factories in `@unit`) and `standard-code.mdc` (errors by class and code). Unit specs live in `__tests__/@unit/{entities,value-objects,codecs,builders,formatters}/` and run with `yarn test:unit`.

## Scope check, before writing

| Asked to unit test                                                 | Answer                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Entity, value object                                               | Yes. `@unit/entities/{entity}.spec.ts`, `@unit/value-objects/{name}.spec.ts` |
| Pure codec (XDR, ScVal, proof encoding), config builder, formatter | Yes. `@unit/codecs`, `@unit/builders`, `@unit/formatters`                    |
| Handler, service, controller, filter, guard                        | No. Point to the `integration-testing` skill                                 |
| Repository, mapper, DAO, gateway                                   | No. `@e2e` proves the round trip; say so and stop                            |

## Procedure

1. **List the rules** of the class before opening the spec: every `create` validation, every transition and its refusal, every `isX` and `ensureX`. That list is the `it` list. Getters, `restore` and `toX` mappers get no test.
2. **Reference row in the catalog.** Open `app/docs/__test__/cenarios.md`. If the rule maps to a CT, the `it` name starts with the id. If it is a rule the QA cannot see, it belongs in the "Regras de entidade sem CT" table; add it there if missing.
3. **Arrange by hand.** A local `restoreWith(overrides)` helper at the top of the file is fine when the entity has more than five props (see `@unit/entities/credential.spec.ts`); it is a literal, not a factory with logic. No `faker`, no shared mocks, no `makeSut`.
4. **One transition per test**, asserting the new state and, when a date is touched, that `updatedAt` moved. For refusals assert the error class and, once the entity uses `DomainError`, the `code`: `expect(act).toThrow(InvalidStateError)` plus `toMatchObject({ code: "CREDENTIAL_ALREADY_REVOKED" })`. Legacy entities throw `BadRequestException`; assert the class only, the message is Portuguese and will change.
5. **Table tests with `it.each`** for "every status except X" cases, so a new enum value fails loudly.
6. **Value objects**: one test per accepted shape, one `it.each` for rejected shapes, one for derived getters. Chain-typed values (Stellar accounts) need a checksum-valid example: generate once with `Keypair.random().publicKey()` and paste the literal; never a fabricated `GAAA…` string.
7. Run the file alone: `yarn test:unit __tests__/@unit/entities/{entity}.spec.ts`, then `yarn lint` and `yarn prettier:check`.

## Shape

```ts
describe("Credential", () => {
  describe("revoke", () => {
    it("CT-VESTA-CRED-010 moves an ACTIVE credential to REVOKED", () => {
      // Arrange
      const credential = restoreWith(CredentialStatus.Active);

      // Act
      credential.revoke();

      // Assert
      expect(credential.status).toBe(CredentialStatus.Revoked);
    });
  });
});
```

## Refuse

- A test whose name repeats the implementation ("calls Id.create") or asserts a getter.
- A spec that imports `@nestjs/testing`, `PrismaService` or anything from `infra/`.
- Mocking a dependency to make an entity testable: the entity is wrong, not the test. Report it and add a legacy-map note.
