# Task 4: Rotação com prazo de convivência de 30 dias

Track: `task_01m3mwrhsde8pbza1t2avk8b75` · EP 2 · feature `feature_01m37qasbne4fr7pfvhhkpbk9z`

Read `prd.md` and `techspec.md` in this folder before starting. Depends on task 3. Skills: `new-module` (modo B), `unit-testing`, `integration-testing`, `e2e-testing`.

## Contempla

- `ApiKey.rotate(now)`: exige `ensureUsable(now)`, devolve `{ next, secret }` com `next = ApiKey.create(name, issuerId)` e marca `expiresAt = now + ROTATION_GRACE_DAYS` nesta.
- Commands e handlers `api-key-{admin,backoffice}-rotate`: admin lê com `findByIdOrThrow`, backoffice com `findByIdForIssuerOrThrow` (404 para key de outro issuer), `saveOrThrow(next)` e depois `updateOrThrow(current)`, sem transação (falha no segundo write deixa uma key nova válida e a antiga sem prazo; o operador repete). Resultado `{ id, issuerId, name, key, keyPrefix, createdAt, previous: { id, expiresAt } }`.
- Rotas `/admin/api-keys/:id/rotate` e `/backoffice/api-keys/:id/rotate` (método de criação), sem `@Throttle` por não serem `/public`.
- Listagens passam a devolver `expiresAt`.
- `app/docs/api-key-rotation.md`: texto de comunicação ao cliente em produção. Nada muda nesta release; a rotação com prazo será pedida na seguinte pelo canal que a D2 definir.
- Catálogo de cenários: AUTH-007 e AUTH-008 novos.

## Critério de pronto

- E2E: após rotacionar, as duas keys autenticam no `/public`; a antiga aparece na listagem com `expiresAt` 30 dias à frente; a nova sem `expiresAt`.
- E2E: key com `expires_at` no passado (ajustado direto no banco pelo spec) responde 401 `API_KEY_EXPIRED` no `/public`; rotacionar uma key expirada ou revogada responde 422.
- E2E backoffice: rotacionar key de outro issuer responde 404 `API_KEY_NOT_FOUND`.
- Spec unit de `rotate`; spec de integração do handler de backoffice (posse).
- Gates verdes, `code-reviewer` sem achado bloqueante.

## Fora desta task

- Botão de rotação e exibição de `expiresAt` no front do backoffice: task no repo `vesta-aws-app-front-backoffice`, criada ao concluir esta (PRD RF-010).
- Forçar a rotação do cliente com data e apagar a coluna em claro (release seguinte, D2).
- Evento `ApiKeyRotatedEvent`: nasce com a trilha de auditoria (F4-007).

## Files

- `app/src/modules/api-key/domain/api-key.entity.ts`
- `app/src/modules/api-key/application/{admin,backoffice}/{commands,handlers}/api-key-*-rotate.*`
- `app/src/modules/api-key/api/{admin,backoffice}/api-key-*.controller.ts`, `api/api-key.output.ts`
- `app/docs/api-key-rotation.md`, `app/docs/__test__/cenarios.md`
- `app/__tests__/@unit/entities/api-key.spec.ts`, `app/__tests__/@integration/handlers/api-key-backoffice-rotate.handler.spec.ts`, `app/__tests__/@e2e/{admin,backoffice}-api-keys.spec.ts`

## Tests

- `@unit`: `rotate` cria key do mesmo issuer e nome, marca 30 dias na antiga, lança em key expirada ou revogada.
- `@integration/handlers`: rotacionar no backoffice rejeita key de outro issuer.
- `@e2e`: AUTH-007 (duas keys ativas após rotação), AUTH-008 (expirada responde `API_KEY_EXPIRED`).
