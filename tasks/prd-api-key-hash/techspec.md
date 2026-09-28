# Tech spec: API keys com hash, prefixo visível e rotação com prazo

PRD: `tasks/prd-api-key-hash/prd.md`

## Summary

A API key vira um agregado próprio, `modules/api-key`, nascido no padrão (`standard-module`, modo A da skill `new-module`): entidade com as regras de uso, expiração, rotação e posse; repositório por token abstrato; DAO para listagem; um handler por caso de uso e contexto; controllers `admin` e `backoffice` com input DTO. O segredo é um value object (`ApiKeySecret`) que gera, hasheia e compara em tempo constante. Nada de `api-key.service.ts` sobrevive: os três arquivos legados que a task toca (`infra/auth/api-key.service.ts`, `infra/auth/admin.controller.ts`, `backoffice/api-keys/api/api-keys-backoffice.controller.ts`) são movidos para o módulo no mesmo commit em que mudam, como manda o legacy map. O `ApiKeyGuard` continua em `infra/auth` (é transversal, `APP_GUARD`) e passa a depender do token `IApiKeyRepository` e do value object, não mais de um service.

Decisões: hash SHA-256 sem salt (segredo de 192 bits aleatórios, lookup precisa de índice); nenhum fallback de leitura em claro, porque o backfill em SQL hasheia todas as linhas na própria migration; falhas de autenticação continuam 401 mas ganham `code` no corpo, no mesmo formato do `DomainErrorFilter`; os erros de domínio das rotas admin e backoffice passam pelo filtro e deixam de ser 401 (o front do backoffice faz logout em qualquer 401, então isso corrige um bug real). Detalhes de implementação que estavam no PRD e vêm para cá: formato do prefixo (RF-002), `timingSafeEqual` (RF-004), 30 dias como constante (RF-005), nomes dos códigos (RF-007).

## Modules and files

| Module | State today (legacy map) | What changes | Files |
| --- | --- | --- | --- |
| `api-key` (novo) | não existe | Nasce no alvo com contextos `admin` e `backoffice` | `src/modules/api-key/api-key.module.ts` · `domain/api-key.entity.ts` · `domain/api-key-secret.value-object.ts` · `domain/api-key.repository.ts` · `infra/api-key.mapper.ts` · `infra/api-key.repository.ts` · `infra/api-key.data-access-object.ts` · `application/{admin,backoffice}/commands/api-key-{ctx}-{create,rotate,revoke}.command.ts` · `application/{admin,backoffice}/queries/api-key-{ctx}-list.query.ts` · `application/{admin,backoffice}/handlers/api-key-{ctx}-{create,rotate,revoke,list}.handler.ts` · `api/{admin,backoffice}/inputs/api-key-{ctx}-create.input.ts` · `api/{admin,backoffice}/api-key-{ctx}.controller.ts` · `api/api-key.output.ts` |
| `infra/auth` | Mixed | `api-key.service.ts` some (lógica vai para entidade, VO, repositório e handlers). `admin.controller.ts` move para `modules/api-key/api/admin/api-key-admin.controller.ts`. `api-key.guard.ts` fica, troca `ApiKeyService` por `IApiKeyRepository` + `ApiKeySecret`, perde o log de prefixo, ganha `code`. `auth.module.ts` importa `ApiKeyModule`, remove `ApiKeyService` e `AdminController` | `src/infra/auth/api-key.guard.ts` · `src/infra/auth/auth.module.ts` |
| `backoffice` | Anti-target | `api-keys/api/api-keys-backoffice.controller.ts` move para `modules/api-key/api/backoffice/api-key-backoffice.controller.ts`; `backoffice.module.ts` deixa de declará-lo; a pasta `backoffice/api-keys` some | `src/modules/backoffice/backoffice.module.ts` |
| `app.module` | | registra `ApiKeyModule` | `src/app.module.ts` |
| seeds | | `local-fixtures.sql` e `e2e.seed.sql` inserem `key_hash` e `key_prefix` calculados em SQL a partir do literal; coluna `key` não é mais preenchida | `src/infra/database/seeds/*.sql` |
| docs | | legacy map ganha a linha `api-key · On target` e ajusta `infra/auth` e `backoffice`; TD-005 fecha; `decisions.md` ganha a linha do hash sem salt; skill `prisma-migration` fecha a nota "First real use" | `AGENTS.md` · `app/docs/tech-debt.md` · `app/docs/decisions.md` · `app/docs/deploy-checklist.md` |

`AuthModule` é `@Global` e passa a importar `ApiKeyModule`; `ApiKeyModule` importa só `DatabaseModule` e `CqrsModule` e usa `@AdminSecret()` e `@BackofficeAuth()` como decorators de arquivo. Sem ciclo, sem `forwardRef`.

## Domain

- **`ApiKeySecret`** (value object, importa só `node:crypto`): `generate()` devolve `{ secret, hash, prefix }` com `secret = "vesta_live_" + randomBytes(24).hex`, `hash = sha256(secret).hex`, `prefix = secret.slice(0, 19)`; `hashOf(raw)`; `matches(hash, candidateHash)` com `timingSafeEqual` sobre buffers de mesmo tamanho (retorna `false` se os tamanhos diferem). O segredo em claro nunca entra em prop de entidade.
- **`ApiKey`** (entidade): props `id: Id`, `issuerId: string | null`, `keyHash: string`, `keyPrefix: string`, `name: string`, `active: boolean`, `createdAt`, `revokedAt: Date | null`, `expiresAt: Date | null`.
  - `create(name, issuerId)` → `{ apiKey, secret }`; valida `name` não vazio (`ValidationError API_KEY_NAME_REQUIRED`); id `Id.create("ak")` (mesmo prefixo das linhas atuais, formato TypeID).
  - `rotate(now)` → `{ next, secret, expiresAt }`: `next = ApiKey.create(this.name, this.issuerId)`, e `this.expiresAt = now + 30 dias` (constante `ROTATION_GRACE_DAYS = 30` na entidade). Exige `ensureUsable(now)` antes e recusa key que já tem `expiresAt` (`InvalidStateError API_KEY_ALREADY_ROTATED`): rotacionar de novo a key antiga estenderia o prazo dela sem fim; o issuer rotaciona a nova.
  - `revoke(now)`: `active = false`, `revokedAt = now`; já revogada → `InvalidStateError API_KEY_ALREADY_REVOKED`.
  - `isExpired(now)`, `isUsable(now)` = `active && issuerId !== null && !isExpired(now)`.
  - `ensureUsable(now)` → `InvalidStateError API_KEY_REVOKED` ou `API_KEY_EXPIRED`.
  - `restore(props)` sem validação.
- Eventos: nenhum. Não há consumidor hoje; `ApiKeyRotatedEvent` nasce quando a trilha de auditoria (F4-007) precisar.

## Application

| Use case | Kind | Handler | Input | Result |
| --- | --- | --- | --- | --- |
| Criar key (admin) | command | `ApiKeyAdminCreateHandler` | `name`, `issuerId` | `{ id, issuerId, name, key, keyPrefix, createdAt }` |
| Criar key (backoffice) | command | `ApiKeyBackofficeCreateHandler` | `name`, `issuerId` da sessão | idem |
| Rotacionar (admin) | command | `ApiKeyAdminRotateHandler` | `apiKeyId` | `{ id, issuerId, name, key, keyPrefix, createdAt, previous: { id, expiresAt } }` |
| Rotacionar (backoffice) | command | `ApiKeyBackofficeRotateHandler` | `apiKeyId`, `issuerId` da sessão | idem; lê com `findByIdForIssuerOrThrow` (404 para key de outro issuer) |
| Revogar (admin) | command | `ApiKeyAdminRevokeHandler` | `apiKeyId` | `{ revoked: true, id }` |
| Revogar (backoffice) | command | `ApiKeyBackofficeRevokeHandler` | `apiKeyId`, `issuerId` | idem; lê com `findByIdForIssuerOrThrow` (404 para key de outro issuer) |
| Listar (admin) | query | `ApiKeyAdminListHandler` | nenhum | linhas do DAO: `id, issuerId, name, keyPrefix, active, createdAt, revokedAt, expiresAt` |
| Listar (backoffice) | query | `ApiKeyBackofficeListHandler` | `issuerId` | idem, filtrado |

Rotação faz dois writes: `saveOrThrow(next)` e depois `updateOrThrow(current)`. Sem transação: se o segundo falhar, sobra uma key nova válida e a antiga sem prazo, estado inofensivo; o operador repete a rotação. `findByIdOrThrow` lança `NotFoundError API_KEY_NOT_FOUND` (404). Nenhum handler tem mais de duas dependências, então não há `application/services/`. O admin não valida se o issuer existe, igual hoje; fica registrado como fora de escopo.

Repositório (`IApiKeyRepository`): `findByHash(hash): ApiKey | null` (sem filtro de `active`, a regra é da entidade), `findByIdOrThrow(id)` (admin), `findByIdForIssuerOrThrow(id, issuerId)` (backoffice: filtra pelo issuer na query e responde `API_KEY_NOT_FOUND`, nunca 403), `saveOrThrow`, `updateOrThrow`. DAO: `listAll()`, `listByIssuer(issuerId)`, `select` sem `key` nem `keyHash`.

## Infra

- **Schema** (`ApiKey`): `key String? @unique` (passa a nulo), `keyHash String? @unique @map("key_hash")`, `keyPrefix String? @map("key_prefix")`, `expiresAt DateTime? @map("expires_at")`. Índice `[key, active]` fica até a contração.
- **Migration** `add_api_key_hash`, passo de **expansão** da linha "Store a secret" da skill: `ALTER COLUMN key DROP NOT NULL`, três colunas nulas, backfill `UPDATE api_keys SET key_hash = encode(sha256(convert_to(key, 'UTF8')), 'hex'), key_prefix = left(key, 19) WHERE key_hash IS NULL AND key IS NOT NULL`, índice único `api_keys_key_hash_key` no nome que o Prisma dá. `sha256()` é nativo do Postgres 16, sem extensão. Cabeçalho explica a expansão e por que o backfill roda duas vezes sem efeito. O app antigo, durante o rollout, continua lendo e escrevendo `key`: uma key criada pela versão nova nesses minutos não resolve na antiga, e só nesses minutos.
- **Contração** (release seguinte, task própria, depende de D2): `DROP COLUMN key`, `SET NOT NULL` em `key_hash` e `key_prefix`, remove o índice `[key, active]`.
- **Mapper**: `toDomain` lança `InvalidStateError API_KEY_NOT_HASHED` se `keyHash` ou `keyPrefix` vierem nulos (impossível após o backfill; nunca `?? ""`). `toCreateInput` não escreve `key`.
- Gateways e ports: nenhum. Env vars: nenhuma.

## API

| Method and path | Context | Auth pairing | Change class |
| --- | --- | --- | --- |
| `POST /admin/api-keys` | admin | `@PublicEndpoint()` + `@AdminSecret()` | Comportamental: DTO, campo extra ou faltando responde 400 (antes 401) |
| `GET /admin/api-keys` | admin | idem | Aditiva: `keyPrefix`, `expiresAt` |
| `DELETE /admin/api-keys/:id` | admin | idem | Comportamental: 404 `API_KEY_NOT_FOUND` e 422 `API_KEY_ALREADY_REVOKED` (antes 401) |
| `POST /admin/api-keys/:id/rotate` | admin | idem | Aditiva |
| `POST /backoffice/api-keys` | backoffice | `@PublicEndpoint()` + `@BackofficeAuth()` (troca o `@UseGuards` manual) | Comportamental: DTO; front envia só `{ name }` |
| `GET /backoffice/api-keys` | backoffice | idem | Aditiva |
| `DELETE /backoffice/api-keys/:id` | backoffice | idem | Comportamental: 404 `API_KEY_NOT_FOUND` (inclui key de outro issuer, `standard-security` § Tenant isolation), 422 (antes 401) |
| `POST /backoffice/api-keys/:id/rotate` | backoffice | idem | Aditiva |
| Todas as `/public/*` | public | `ApiKeyGuard` global | Aditiva: 401 ganha `code` `API_KEY_MISSING`, `API_KEY_INVALID`, `API_KEY_EXPIRED`; header e valor iguais |

O guard lança `UnauthorizedException` com corpo `{ statusCode: 401, code, message, error: "Unauthorized" }`, o mesmo formato do `DomainErrorFilter`, para o cliente ler `code` em qualquer erro. Key revogada responde `API_KEY_INVALID`, não `API_KEY_REVOKED`: revogação é decisão do issuer e não deve ser distinguível por quem usa a key. Rotas de rotação não são `/public`, então não levam `@Throttle`.

## Tests

- `@unit/value-objects/api-key-secret.spec.ts`: formato do segredo, hash é SHA-256 hex do segredo, prefixo de 19 caracteres, `matches` verdadeiro só para hash igual, falso para tamanho diferente.
- `@unit/entities/api-key.spec.ts`: `create` valida nome e não guarda o segredo; `rotate` cria key do mesmo issuer e nome e põe `expiresAt` 30 dias à frente; `rotate` de key expirada ou revogada lança; `revoke` duas vezes lança `API_KEY_ALREADY_REVOKED`; `ensureUsable` cobre revogada, expirada, sem issuer. Sobe o piso de cobertura de `domain/`.
- `@integration/http/api-key.guard.spec.ts` (com `Test.createTestingModule` pelo `Reflector`): header ausente → `API_KEY_MISSING`; hash sem linha → `API_KEY_INVALID`; linha expirada → `API_KEY_EXPIRED`; rota `@PublicEndpoint()` passa sem key. Mocks: `mocks/repository/api-key.repository.mock.ts`, `mocks/model/api-key.model.ts`.
- Handlers de backoffice: o escopo por issuer está na query do repositório, não em branch do handler; criar, revogar e listar são passthrough, sem spec de integração. O isolamento é provado no `@e2e` com dois issuers (404).
- `@e2e`: `admin-api-keys.spec.ts` e `backoffice-api-keys.spec.ts` ajustados para os códigos novos (ADMIN-009, AUTH-005, BO-007). Linhas novas no catálogo: SEC-004 sai de `red` (inspeciona `api_keys` e prova `key IS NULL` e `key_hash` presente na key criada); AUTH-007 rotação mantém as duas keys autenticando no `/public` e a antiga com `expiresAt`; AUTH-008 key com `expires_at` no passado responde 401 `API_KEY_EXPIRED`; AUTH-009 listagem devolve `keyPrefix` e nunca `key`; ADMIN-010 campo extra no body responde 400. `yarn test:e2e` aplica a migration na base de teste; `yarn db:local` numa base com linhas prova o backfill.

## Standards

- `standard-module`: módulo novo no alvo; os três arquivos legados movem no commit em que mudam; `backoffice/api-keys` desaparece. **Desvio**: o `ApiKeyGuard` fica em `infra/auth` e injeta um token de domínio de um módulo. Motivo: é `APP_GUARD`, transversal, e a rule permite importar tokens de `domain/`; movê-lo para o módulo faria `AppModule` depender do módulo pelo guard.
- `standard-code`: `DomainError` com código estável; `Id` do command para dentro; sem `?? ""` no mapper; mensagens em inglês nas linhas tocadas (as mensagens em português do controller de backoffice mudam, sem efeito no `/public`).
- `standard-test`: catálogo atualizado; passthrough sem spec; mocks em arquivo.
- `standard-security`: hash em repouso, comparação em tempo constante, nada da key em log, DTO na borda, `@BackofficeAuth()` no lugar do `@UseGuards` manual. **Desvio consciente**: SHA-256 sem salt e sem bcrypt, pelo motivo do resumo; registrado no `decisions.md`.
- `standard-chain`: não se aplica.
- `prisma-migration`: expansão agora, contração depois; SQL revisado linha a linha pela checklist da skill.

## Outside the repo

Linhas em `app/docs/deploy-checklist.md`:

- **SUB-011** (atualizada): migration `add_api_key_hash`. Staging aplica no CI. Prod: rodar `yarn prisma:deploy` à mão antes do merge para `main`; conferir antes `select count(*) from api_keys where active` e depois `select count(*) from api_keys where key_hash is null` (esperado 0). Testar em staging a key do issuer de teste antes de prod.
- **SUB-012** (atualizada): payload do front verificado, envia só `{ name }`; o front faz logout em 401, e as rotas de key deixam de responder 401 fora de auth. Classe comportamental no PR.
- **Nova**: comunicação ao cliente em produção. Nesta release nada muda para ele. Texto em `app/docs/api-key-rotation.md` avisando que a rotação com prazo será pedida na release seguinte, com o canal a decidir na D2.

## Risks

- Rollout com duas versões: key criada pela versão nova não resolve na antiga por alguns minutos · aceito, janela do ECS; nenhuma key existente é afetada.
- Backfill em prod com linha de `key` nula ou duplicada · impossível pelo `NOT NULL` e `@unique` atuais; a query de conferência da SUB-011 prova.
- Cliente em produção trata algum 401 das rotas admin como "key inválida" · não usa admin nem backoffice para key (D6 confirma); `/public` mantém 401.
- Front do backoffice mostra a key nova de rotação · o hook atual só cobre criar; task do front nasce depois (PRD RF-010).
- Skill `prisma-migration` no primeiro uso real · qualquer ajuste entra no mesmo commit.
