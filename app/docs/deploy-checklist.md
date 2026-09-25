# Subida para staging e produção

Um só lugar para tudo que precisa ser cuidado **fora do repo** quando uma mudança sobe: variável nova, segredo, migration, dado a corrigir no banco, contrato a publicar, informação que precisamos **trazer de lá** antes de decidir algo. O código passa nos gates sozinho; o que está aqui não passa em gate nenhum, por isso é levantado à mão em dois momentos:

1. **Antes de abrir ou atualizar o PR para `staging`**: rodar `yarn deploy:check` e reler a tabela de pendências. O template de PR tem a caixa para isso.
2. **Antes do merge em `main`** (produção): a mesma leitura, com o ambiente `prod`, mais as migrations manuais.

Toda mudança que precisa de algo fora do repo ganha uma linha na tabela de pendências **no mesmo commit** (item 6 do "Definition of done" em `AGENTS.md`). A linha só fecha com data e quem fez.

## Como o deploy acontece hoje (fatos, não intenção)

| Ambiente | Gatilho                          | Migrations                                                                   | Seed              | `NODE_ENV`   |
| -------- | -------------------------------- | ---------------------------------------------------------------------------- | ----------------- | ------------ |
| staging  | push na branch `staging`         | automáticas no job `migrate-database`, antes do build                        | nunca no pipeline | `test`       |
| prod     | push em `main` (`main-workflow`) | **manuais**: `yarn prisma:deploy` com `DATABASE_URL` de prod, antes do merge | nunca no pipeline | `production` |

- Depois do `staging-workflow`, o `release-workflow` cria a branch `release/<tag>`; produção sai dessa branch para `main`.
- As variáveis de cada ambiente vivem em `infra/terraform/envs/{staging,prod}/variables.tfvars`: bloco `environment` para valores em claro, `secrets` para o que vem do Secrets Manager. `yarn deploy:check` compara os dois com `env.schema.ts`.
- `ENV_FILE` não é definido na ECS; o container lê `.env` (o padrão). Se um dia aparecer no tfvars, é erro.
- O shell hook pergunta antes de `prisma migrate deploy` e `db seed` sem `dotenv -e .env.local`, porque leem `app/.env`, que é o staging.

## Checklist fixo (toda subida)

1. `yarn deploy:check` sem `ERROR` para o ambiente alvo. Os `info` são variáveis no default: confirmar que o default é o que o ambiente quer.
2. **Migrations novas**: `git diff --stat staging...HEAD -- app/src/infra/database/@prisma/migrations`. Em prod, rodar `yarn prisma:deploy` à mão antes do merge. Migration que apaga coluna ou tabela precisa de plano de volta escrito na pendência.
3. **Seed nunca** em staging ou prod. Dado necessário vai em migration de dados ou SQL revisado, registrado na tabela abaixo.
4. **Segredo novo**: criado no Secrets Manager e referenciado no bloco `secrets` do tfvars. Valor nunca no repo, nem no PR, nem no chat.
5. **Contrato ou artefato ZK novo**: id do contrato no tfvars, artefatos em `zk-artifacts/` na imagem. Anotar a versão publicada.
6. **Classe da mudança** (aditiva, comportamental, breaking) no PR. Há cliente pagante em produção nos `/public/*`.
7. **Pós-deploy**: `GET /health`, `GET /.well-known/jwks.json` cru, e um `issue -> verify` com o issuer de teste do ambiente. Logs de `[STARTUP]` sem `(não definida)` em variável que importa.
8. **Volta**: issue "Rollback produtivo" (`.github/ISSUE_TEMPLATE/rollback.yml`) para prod; para staging, re-push do commit anterior.

## Pendências abertas

| Id      | Origem                                       | Ambiente      | O que fazer                                                                                                                                                                                                                                       | Trazer de lá                                                                                                               | Estado |
| ------- | -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------ |
| SUB-001 | `af44eee` (seed não roda fixtures em `test`) | staging, prod | Se o issuer local existir no banco, apagar issuer, API key, user de backoffice e verifier de fixture. A API key está em texto puro no repo.                                                                                                       | `select id, name from issuers where name = 'local_bank'`; `select id from api_keys where key like 'vesta_live_local_dev%'` | aberta |
| SUB-002 | `yarn deploy:check` (2026-09-24)             | prod          | `COMMISSION_PER_VERIFICATION_BRL` declarada em `environment` e em `secrets`. Decidir qual vale e remover a outra.                                                                                                                                 | Valor efetivo hoje na task definition da ECS                                                                               | aberta |
| SUB-003 | `yarn deploy:check` (2026-09-24)             | prod          | `PRIVY_CUSTOM_AUTH_PRIVATE_KEY` e `KEY_ID` não existem em prod. Se Privy custom auth não está em uso em prod, registrar isso; se está, criar os segredos e o bloco `privy_custom_auth_secret_names` como no staging.                              | Se algum issuer em prod tem `privy_enabled = true`                                                                         | aberta |
| SUB-004 | `yarn deploy:check` (2026-09-24)             | prod          | `STELLAR_PAYOUT_OPERATOR_SECRET` e `STELLAR_PAYOUT_ASSET_ISSUER` não existem em prod; o processor de payout não assina nada. Confirmar se payout está desligado em prod de propósito.                                                             | Se há `payout_requests` em prod                                                                                            | aberta |
| SUB-005 | `yarn deploy:check` (2026-09-24)             | staging       | `PAYOUT_VAULT_FUNDING_BRL` está no tfvars mas `env.schema.ts` não lê. Remover do tfvars ou adicionar ao schema, conforme o script de deploy do vault usar ou não.                                                                                 | —                                                                                                                          | aberta |
| SUB-006 | Terraform `envs/staging`                     | staging       | `NODE_ENV=test` é o perfil do staging, mas o nome sugere teste automatizado e o código trata `test` como remoto (SSL, logs JSON). Decidir renomear para `staging` (schema, `PrismaService`, seeds, docs) ou registrar em `decisions.md` que fica. | —                                                                                                                          | aberta |
| SUB-007 | PR #95 e PR #96                              | staging       | Ordem de merge: #95 (`chore/local-env`) antes de #96 (`chore/agent-harness`), que nasceu dele.                                                                                                                                                    | —                                                                                                                          | aberta |

## Pendências fechadas

| Id  | Fechada em | Por | Como |
| --- | ---------- | --- | ---- |

## Perguntas que dependem de dado do ambiente

Coisas que não dá para decidir lendo o repo. Quem tiver acesso traz a resposta para cá e a decisão vai para `decisions.md`.

- Quantos issuers e API keys ativos existem em staging e em prod, e quais pertencem ao cliente pagante. Define o escopo dos testes de isolamento por tenant (F2 em `tech-debt.md`).
- `prisma migrate status` em prod: há migration aplicada em staging e ainda não em prod? Só é seguro rodar com `DATABASE_URL` exportada na sessão, nunca apontando o `.env`.
- `REDIS_URL` não existe nos dois ambientes: o `ChallengeService` cai no Postgres. Confirmar que é intencional em prod.
