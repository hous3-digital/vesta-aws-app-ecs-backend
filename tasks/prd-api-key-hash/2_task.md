# Task 2: Domínio e infra do módulo api-key

Track: `task_01m3mwrhrme8pbza1g751r16wm` · EP 2 · feature `feature_01m37qasbne4fr7pfvhhkpbk9z`

Read `prd.md` and `techspec.md` in this folder before starting. Depends on task 1. Skills: `new-module` (modo A, passos 2 a 6 e 9 a 11), `unit-testing`. Reference: `src/modules/credential`.

## Contempla

- `domain/api-key-secret.value-object.ts`: `generate()` devolve `{ secret, hash, prefix }` (`vesta_live_` + 24 bytes hex, `sha256` hex, 19 primeiros caracteres); `hashOf(raw)`; `matches(hash, candidate)` com `timingSafeEqual`, `false` se os tamanhos diferem. Importa só `node:crypto`.
- `domain/api-key.entity.ts`: props `id`, `issuerId: string | null`, `keyHash`, `keyPrefix`, `name`, `active`, `createdAt`, `revokedAt: Date | null`, `expiresAt: Date | null`. `create(name, issuerId)` devolve `{ apiKey, secret }` e valida nome (`ValidationError API_KEY_NAME_REQUIRED`), id `Id.create("ak")`. `restore`. `revoke(now)` (`InvalidStateError API_KEY_ALREADY_REVOKED`). `isExpired(now)`, `isUsable(now)`, `ensureUsable(now)` (`API_KEY_REVOKED`, `API_KEY_EXPIRED`), `ensureOwnedBy(issuerId)` (`ForbiddenError API_KEY_ISSUER_MISMATCH`). Constante `ROTATION_GRACE_DAYS = 30` já declarada; `rotate` fica para a task 4.
- `domain/api-key.repository.ts`: `IApiKeyRepository` com `findByHash`, `findByIdOrThrow` (`NotFoundError API_KEY_NOT_FOUND`), `saveOrThrow`, `updateOrThrow`.
- `infra/api-key.mapper.ts`: `toDomain` lança `InvalidStateError API_KEY_NOT_HASHED` se `keyHash` ou `keyPrefix` vierem nulos; `toCreateInput` não escreve `key`; `toUpdateInput`.
- `infra/api-key.repository.ts` com `PrismaService`; `infra/api-key.data-access-object.ts` com `listAll()` e `listByIssuer(issuerId)`, `select` sem `key` nem `keyHash`.
- `api-key.module.ts` importando `DatabaseModule` e `CqrsModule`, exportando o token e o DAO; registrado no `AppModule`. Sem controllers.
- Mocks: `__tests__/mocks/repository/api-key.repository.mock.ts`, `__tests__/mocks/model/api-key.model.ts`.
- Legacy map em `AGENTS.md`: linha `api-key · On target`.

## Critério de pronto

- `__tests__/@unit/value-objects/api-key-secret.spec.ts` e `__tests__/@unit/entities/api-key.spec.ts` verdes, uma regra por `it`.
- `coverageThreshold` de `domain/` nos jest configs sobe para o valor medido e fica registrado.
- `yarn lint`, `yarn typecheck`, `yarn prettier:check`, `yarn test:unit` verdes. Nenhuma rota muda.

## Fora desta task

- Handlers, controllers, guard e remoção do service legado (task 3).
- `rotate` e `expiresAt` nas transições (task 4).

## Files

- `app/src/modules/api-key/{api-key.module.ts,domain/*,infra/*}`
- `app/src/app.module.ts`, `AGENTS.md`, `app/config/jest-unit.config.ts`
- `app/__tests__/@unit/{entities,value-objects}/api-key*.spec.ts`, `app/__tests__/mocks/{repository,model}/api-key.*.ts`

## Tests

- `@unit`: segredo no formato, hash é sha256 hex do segredo, prefixo de 19 caracteres, `matches` só para hash igual e falso para tamanho diferente; `create` valida nome e não guarda o segredo; `revoke` duas vezes lança; `ensureUsable` cobre revogada, expirada e sem issuer; `ensureOwnedBy` lança para outro issuer.
