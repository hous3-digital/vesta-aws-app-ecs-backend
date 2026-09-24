---
name: new-module
description: Procedure to create a feature module on the target tree, add a use case to an existing module, or move a legacy file into place when a task touches it. Use when the user asks for a new module, a new endpoint, a new handler, or when a change lands in a flat module (challenge, commission, stellar, vc, wallet, zk, backoffice).
---

# New module

Applies `standard-module.mdc` (where files go, how they depend on each other) and `standard-code.mdc` (how each file is written). Read both before starting. Tests follow the layer table in `AGENTS.md`.

Reference implementation: `src/modules/credential`. When in doubt about the shape of an artifact, open the credential file of the same kind and copy its structure, not its content.

Three modes. Pick one before touching anything.

| Mode             | When                                                                         | Result                                                                |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A · Create       | A new aggregate with its own table                                           | Whole tree, module registered in `AppModule`                          |
| B · Extend       | A new use case in a module that is already on target (`credential`, `proof`) | Command or query, handler, input, controller method                   |
| C · Touch legacy | A task changes a file in a flat module                                       | That file moved to its target folder in the same commit, nothing else |

## Mode A · Create a module

Order matters: each step compiles on its own, so `yarn typecheck` can run after every one.

1. **Schema.** Add the model to `src/infra/database/@prisma/schema.prisma` with `@map` snake_case columns and a status enum when the aggregate has a lifecycle. `yarn prisma:migrate` names the migration `add-{module}`. Ids are TypeID strings with the module name as prefix.
2. **Entity** in `domain/{entity}.entity.ts`. Copy the layout of `credential.entity.ts`: props interface, private fields, private constructor, getters, static `create` (validates, sets `createdAt`), static `restore` (no validation), transitions, `isX` and `ensureX`. Errors are `DomainError` subclasses from `@src/shared/errors`, never `@nestjs/common`. If the status enum exists in Prisma, declare its twin here with the same values.
3. **Repository token** in `domain/{entity}.repository.ts`: `export abstract class I{Entity}Repository` with only the methods the first use case needs. Name them by miss behaviour (`findByX` returns `null`, `findByIdOrThrow` throws `NotFoundError`, `saveOrThrow`, `updateOrThrow`).
4. **Mapper** in `infra/{entity}.mapper.ts`: `toDomain`, `toCreateInput`, `toUpdateInput`, field by field in schema order.
5. **Repository** in `infra/{entity}.repository.ts` implementing the token with `PrismaService`. No business logic, no `include`.
6. **DAO** in `infra/{entity}.data-access-object.ts` only when there is a listing or search. It returns Prisma rows and takes `issuerId` as the first argument of every backoffice query.
7. **Use case.** For a write: `application/{context}/commands/{module}-{context}-{action}.command.ts` (a class with `public readonly` fields, ids as strings) and the handler next to it with an exported `{Action}Result` type. For a read: the query and its handler using the DAO. The handler orchestrates only; if it needs more than four dependencies, extract `application/services/{name}.service.ts`.
8. **API.** Input DTO in `api/{context}/inputs/` with `class-validator` and `@ApiProperty` on every field. Controller `api/{context}/{module}-{context}.controller.ts` with `@ApiTags`, `@Controller("/{context}/{module}")`, the context guard (`BackofficeAuthGuard` or `AdminSecretGuard`; public routes rely on the global `ApiKeyGuard`), `@Throttle` on public routes, one `@ApiOperation({ summary })` per method. The method builds the command and returns `commandBus.execute`.
9. **Module.** `{module}.module.ts` imports `DatabaseModule` and `CqrsModule`, declares controllers, handlers, DAO and `{ provide: I{Entity}Repository, useClass: {Entity}Repository }`, exports only the token and the DAO. Register it in `AppModule`.
10. **Tests.** `__tests__/@unit/entities/{entity}.spec.ts` for every rule the entity holds. `__tests__/@integration/handlers/{module}-{context}-{action}.handler.spec.ts` only if the handler branches; a passthrough handler gets no test.
11. **Legacy map.** Add the module row to the table in `AGENTS.md` with state "On target".
12. **Gates.** `yarn lint`, `yarn typecheck`, `yarn prettier:check`, `yarn test:unit`, `yarn test:integration`.

Minimum wiring, for reference:

```ts
// domain/verifier.repository.ts
export abstract class IVerifierRepository {
  public abstract findByIdOrThrow(id: Id): Promise<Verifier>;
  public abstract saveOrThrow(verifier: Verifier): Promise<Verifier>;
}

// verifier.module.ts
@Module({
  imports: [DatabaseModule, CqrsModule],
  controllers: [VerifierBackofficeController],
  providers: [
    VerifierBackofficeCreateHandler,
    { provide: IVerifierRepository, useClass: VerifierRepository },
  ],
  exports: [IVerifierRepository],
})
export class VerifierModule {}
```

## Mode B · Extend a module on target

Steps 7, 8, 10 and 12 of mode A. Add a repository method or a DAO method only if the use case needs it, and add it to the token first. If the new use case belongs to a context the module does not have yet (first backoffice endpoint of `credential`), create `api/backoffice/` and `application/backoffice/` and move nothing else.

## Mode C · Touch a legacy file

The task is something else (a fix, a feature). The move is a side effect and stays small.

1. Find the target folder for the file using the tree in `standard-module.mdc`: a `*.service.ts` with orchestration goes to `application/services/`, one with persistence goes to `infra/`, a gateway abstract class goes to `domain/`, its Soroban implementation stays where it is until F3 (`app/docs/tech-debt.md`).
2. `git mv` the file. Do not rename the class in the same commit unless the name breaks `standard-module` naming.
3. Fix imports: `grep -rn "old/path" src __tests__`. Absolute paths only.
4. Move its spec to the matching test folder if one exists.
5. Make the change the task asked for.
6. If the module state in the legacy map changed (last flat file gone), update the row in `AGENTS.md`.
7. Gates.

What mode C never does: move a file the task does not change, add a method to a root `*.service.ts`, create a file under `modules/backoffice/`, import a service class from another module, throw `BadRequestException` from an entity.

## Before finishing

- Every new file sits in the tree of `standard-module.mdc` and is named by `{module}-{context}-{action}`.
- No import crosses into another module's `application/` or `infra/`.
- The entity has a unit test per rule; passthrough code has no test.
- Change class stated for the PR: a new module or endpoint is additive.
