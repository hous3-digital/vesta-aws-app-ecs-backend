# Task 3: Módulo api-key com hash, DTOs e guard com códigos (#357)

Track: `task_01m37yf3j4esj953630bp08rby` · EP 3 · feature `feature_01m37qasbne4fr7pfvhhkpbk9z`

Read `prd.md` and `techspec.md` in this folder before starting. Depends on task 2. Skills: `new-module` (modo A passos 7 e 8, modo C para os três arquivos legados), `integration-testing`, `e2e-testing`. É o núcleo do SEC-004 #357 e do TD-005.

## Contempla

- Commands, queries e handlers em `application/{admin,backoffice}/`: criar, listar e revogar por contexto (6 handlers). Backoffice lê com `findByIdForIssuerOrThrow` (novo no token), que filtra pelo issuer na query e responde 404 para key de outro issuer (`standard-security` § Tenant isolation). Criação devolve `{ id, issuerId, name, key, keyPrefix, createdAt }`; a key inteira sai só aqui.
- Inputs `api-key-{ctx}-create.input.ts` com `class-validator` e `@ApiProperty`; `api/api-key.output.ts`.
- `infra/auth/admin.controller.ts` move (`git mv`) para `api/admin/api-key-admin.controller.ts`; `backoffice/api-keys/api/api-keys-backoffice.controller.ts` move para `api/backoffice/api-key-backoffice.controller.ts` e troca `@UseGuards(BackofficeAuthGuard)` por `@BackofficeAuth()`. Controllers só montam command ou query e executam no bus. Rotas e paths iguais.
- `ApiKeyGuard` passa a injetar `IApiKeyRepository`, calcula `ApiKeySecret.hashOf`, chama `findByHash`, `matches` em tempo constante e `isUsable(now)`. Responde `UnauthorizedException` com corpo `{ statusCode: 401, code, message, error }`: `API_KEY_MISSING`, `API_KEY_INVALID` (inclui revogada), `API_KEY_EXPIRED`. Log só "invalid api key attempt", sem nada da key.
- `api-key.service.ts` apagado; `AuthModule` importa `ApiKeyModule` e deixa de declarar service e `AdminController`; `BackofficeModule` deixa de declarar o controller; pasta `backoffice/api-keys` some.
- Docs no mesmo commit: legacy map (`infra/auth` e `backoffice` ajustados), TD-005 fechado com o id da task, `decisions.md` com a linha datada "sha256 sem salt para API key" e o motivo, catálogo de cenários (SEC-004 sai de `red`, ADMIN-009, AUTH-005, BO-007 ajustados, ADMIN-010 novo), SUB-012 marcada como conferida (front envia só `{ name }` e faz logout em 401).

## Critério de pronto

- `admin-api-keys.spec.ts` e `backoffice-api-keys.spec.ts` verdes com os códigos novos: validação 400, não encontrado 404 `API_KEY_NOT_FOUND`, key de outro issuer 404 `API_KEY_NOT_FOUND`, já revogada 422 `API_KEY_ALREADY_REVOKED`, campo extra 400.
- SEC-004: key criada pela rota tem `key` nula e `key_hash` presente no banco (o spec inspeciona a linha).
- `__tests__/@integration/http/api-key.guard.spec.ts` cobre os três códigos e a rota `@PublicEndpoint()` sem key.
- `surface.spec.ts` e `public-*.spec.ts` inalterados e verdes: header e valor da key iguais.
- `yarn lint`, `yarn typecheck`, `yarn prettier:check`, `yarn test:unit`, `yarn test:integration`, `yarn test:e2e` verdes. `code-reviewer` sem achado bloqueante.

## Fora desta task

- Rotação e `expiresAt` nas rotas (task 4).
- Remover a coluna em claro e forçar rotação do cliente (release seguinte, D2).
- `AdminSecretGuard` com comparação em tempo constante (TD-006, task de segredos obrigatórios).
- Validar existência do issuer na criação pelo admin: não existe hoje, segue igual.

## Files

- `app/src/modules/api-key/{api,application}/**`
- `app/src/infra/auth/{api-key.guard.ts,auth.module.ts}`; apagar `api-key.service.ts`; mover `admin.controller.ts`
- `app/src/modules/backoffice/backoffice.module.ts`; apagar `backoffice/api-keys/`
- `AGENTS.md`, `app/docs/{tech-debt.md,decisions.md,deploy-checklist.md,__test__/cenarios.md}`
- `app/__tests__/@integration/http/api-key.guard.spec.ts`, `app/__tests__/@e2e/{admin,backoffice}-api-keys.spec.ts`, `app/__tests__/@e2e/fixtures/{admin,backoffice}-api.fixture.ts`

## Tests

- `@integration/http`: guard, três códigos e bypass do `@PublicEndpoint()` (`Test.createTestingModule` pelo `Reflector`).
- `@integration/handlers`: nenhum. Os handlers são passthrough (o escopo por issuer está na query); o isolamento é provado no `@e2e` com dois issuers.
- `@e2e`: ADMIN-009, AUTH-005, BO-007, SEC-004, ADMIN-010 (campo extra responde 400), AUTH-009 (listagem devolve `keyPrefix` e nunca `key`).
