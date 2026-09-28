# Task 1: Migration de expansão com key_hash, key_prefix e expires_at

Track: `task_01m3mwrhqpe8pbza1en2wpsq2q` · EP 2 · feature `feature_01m37qasbne4fr7pfvhhkpbk9z`

Read `prd.md` and `techspec.md` in this folder before starting. Skill: `prisma-migration` (passo de expansão da linha "Store a secret").

## Contempla

- Schema `ApiKey`: `key String? @unique` (passa a nulo), `keyHash String? @unique @map("key_hash")`, `keyPrefix String? @map("key_prefix")`, `expiresAt DateTime? @map("expires_at")`. Índice `[key, active]` fica.
- `yarn prisma:migrate:local --create-only --name add_api_key_hash`, depois editar o SQL: cabeçalho (o que muda, por que é expansão, por que o backfill roda duas vezes sem efeito), `key` aceita nulo, três colunas nulas, backfill idempotente com `sha256()` nativo do Postgres 16 e `left(key, 19)` só onde `key_hash` está nulo, índice único com o nome que o Prisma dá.
- `yarn prisma:migrate:local` aplica, `yarn prisma:gen` regenera o client.
- `local-fixtures.sql` (o `e2e.seed.sql` é só um comentário de compatibilidade): a key de dev passa a ser inserida também como hash e prefixo calculados em SQL a partir do literal. A coluna em claro continua preenchida nesta task porque o guard antigo ainda lê `key`; a task 3 tira-a do insert.
- `app/docs/deploy-checklist.md`: SUB-011 vira a linha desta migration com o passo manual em prod (`yarn prisma:deploy` antes do merge para `main`), a contagem de keys ativas antes e a contagem de `key_hash` nulo depois (esperado zero).
- Se a skill `prisma-migration` precisar de ajuste no primeiro uso real, ajustar no mesmo commit e fechar a nota "First real use".
- Deriva encontrada ao gerar o SQL: o índice `commission_ledger_entries_issuer_external_id_status_available_at_idx` foi criado em 2026-08-10 com 68 caracteres e o Postgres truncou o nome; o Prisma propõe o rename em toda migration nova. Migration própria `rename_commission_ledger_index`, só metadado, no mesmo commit.

## Critério de pronto

- `yarn test:e2e` aplica a migration na base de teste e todos os specs atuais continuam verdes com o código antigo, que ainda escreve e lê `key`.
- `yarn db:local` numa base com linhas mostra `key_hash` e `key_prefix` preenchidos em todas.
- SQL revisado linha a linha pela checklist da skill: nenhum drop, nenhuma coluna nova sem nulo ou default.
- `yarn lint`, `yarn typecheck`, `yarn prettier:check` verdes.

## Fora desta task

- Qualquer código que leia ou escreva o hash (tasks 2 e 3).
- Remover a coluna `key` e tornar `key_hash` obrigatório: release seguinte, task de contração, depende da D2.

## Files

- `app/src/infra/database/@prisma/schema.prisma`
- `app/src/infra/database/@prisma/migrations/{timestamp}_add_api_key_hash/migration.sql`
- `app/src/infra/database/seeds/local-fixtures.sql`, `app/src/infra/database/seeds/e2e.seed.sql`
- `app/docs/deploy-checklist.md`
- `.cursor/skills/prisma-migration/SKILL.md` (se precisar)

## Tests

- Nenhum spec novo. A prova é `yarn test:e2e` (migration aplica numa base que não é a de origem) e `yarn db:local` (backfill em base com linhas).
