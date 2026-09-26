# Pedidos de mudança no CI/CD — para o time de infra

**Contexto.** Os workflows em `.github/workflows/` são escritos à mão neste repo (a Block usa o `shared-backend-ci.yml@v1.36.2` da Hous3). Quem mantém o fluxo da plataforma é o time de infra, então o time de produto não altera os workflows: este documento registra **o que** precisa mudar, **por quê** e a **evidência**, para virar pedido quando fizer sentido. Data do levantamento: 2026-09-24, branch `chore/local-env`.

O harness de agentes (`AGENTS.md`, hooks, commitlint) cobra padrão na máquina do dev. O CI é a segunda linha, e hoje ela deixa passar mais do que bloqueia.

## 1. Como está hoje

| Workflow           | Dispara em                                         | O que roda                                                                                                      | O que bloqueia o passo seguinte                                                                    |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `feature-workflow` | push em `feat/**`, `chore/**`, `fix/**`, `task/**` | cargo test + build dos 2 contratos, install, lint, audit-ci, `test:cov` + threshold 10%, abre PR para `staging` | Só o **lint** condiciona o PR (`pull-request: needs: lint`)                                        |
| `staging-workflow` | push em `staging`                                  | os mesmos jobs + terraform ci/cd, **`yarn prisma:deploy` automático**, build da imagem, blue/green              | Imagem depende de `[migrate-database, lint]`. **Teste não entra na cadeia**                        |
| `main-workflow`    | push em `main`                                     | os mesmos jobs + terraform prod, build, blue/green, confirm-release                                             | Terraform CD depende de `[terraform-ci, lint]`. **Teste não entra na cadeia**. Não roda migrations |
| `release-workflow` | manual                                             | cria branch de release                                                                                          | —                                                                                                  |

Fatos que sustentam os pedidos abaixo (linhas do `feature-workflow.yml`, idênticas em `staging` e `main`):

- `test` roda `yarn test:cov` com `continue-on-error: true`. Suite quebrada não falha o job.
- `security-scan` roda `yarn audit:ci` com `continue-on-error: true`. Vulnerabilidade nunca falha o job.
- Não existe passo de `typecheck`, `prettier:check`, `test:integration`, `test:e2e` nem gitleaks (há `.gitleaks.toml` na raiz sem job que o use).
- O job `install` sobe `node_modules` como artifact, mas `lint` e `test` rodam `yarn install` de novo. Artifact inútil, minutos gastos à toa.
- Threshold de cobertura é 10% sobre `src/**` inteiro, calculado por script de shell com `jq` e `bc`.
- `pull-request` usa `actions/checkout@v3` e um `sleep 4`.

## 2. Pedidos, por prioridade

Esforço: **P** até meio dia · **M** 1 a 3 dias.

### P0 — o que deixa bug passar hoje

| #   | Pedido                                                                                                                                                                                                              | Por quê                                                                                               | Esforço |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------- |
| 1   | Remover `continue-on-error: true` do job `test` nos 3 workflows                                                                                                                                                     | Hoje teste vermelho não impede PR, deploy em staging nem em prod. É o único motivo de a suíte existir | P       |
| 2   | Incluir `test` na cadeia de dependências: `pull-request: needs: [lint, test]`, `build-and-deploy-image: needs: [migrate-database, lint, test]` (staging) e `terraform-cd: needs: [terraform-ci, lint, test]` (main) | Mesmo com o item 1, o deploy segue porque nenhum job de deploy depende de `test`                      | P       |

### P1 — o que o harness já cobra local e o CI precisa cobrar também

| #   | Pedido                                                                                                                                                            | Por quê                                                                                                                                                                                                         | Esforço |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 3   | Passo `yarn typecheck` (`tsc --noEmit`) no CI, ao lado do lint                                                                                                    | Lint não pega erro de tipo. O script já existe no `package.json` desde o commit `chore(harness)`                                                                                                                | P       |
| 4   | Passo `yarn prettier:check`                                                                                                                                       | O hook formata na máquina do dev, mas commit feito fora do agente passa sem formato. **Pronto para entrar**: o commit `style:` (`6ff323a`) formatou os arquivos legados e `prettier:check` está verde na branch | P       |
| 5   | Job `test:integration` com Postgres 16 e Redis 7 como `services:` do GitHub Actions, `DATABASE_URL` e `REDIS_URL` apontando para eles, migrations aplicadas antes | A camada `@integration` está sendo criada na task de harness e não tem como rodar sem banco. Compose local já define as mesmas imagens (`app/docker-compose.yml`)                                               | M       |
| 6   | Job de segredos com gitleaks usando o `.gitleaks.toml` da raiz, bloqueante                                                                                        | O arquivo de config existe e nada o executa. O `shared-backend-ci.yml` tem `enable_secrets_scan` pronto                                                                                                         | P       |
| 7   | Passo de commitlint validando os commits do PR (`commitlint --from origin/staging`)                                                                               | O husky cobra local, mas hook local é opt-out. **Depende** do commit que adiciona `commitlint.config.js`                                                                                                        | P       |

### P2 — higiene e estratégia

| #   | Pedido                                                                                                                                                                         | Por quê                                                                                                                                   | Esforço |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 8   | Mover o threshold de cobertura para `coverageThreshold` no `jest-unit.config.ts` e coletar só de `src/**/domain/**` (como o `AGENTS.md` define)                                | Script de shell com `jq`/`bc` é frágil e mede o repo inteiro, o que premia testar service em vez de domínio                               | P       |
| 9   | `audit-ci` bloqueante para `high` e `critical`, depois de revisar o `.auditignore`                                                                                             | Hoje é informativo. Vesta custodia credenciais; vulnerabilidade conhecida em dependência direta precisa parar o PR                        | P       |
| 10  | Remover o artifact de `node_modules` do job `install` ou fazer os outros jobs baixarem em vez de reinstalar                                                                    | Custo de minutos em todo push sem benefício                                                                                               | P       |
| 11  | Avaliar trocar os jobs manuais pelo `shared-backend-ci.yml` da Hous3, como a Block (`feature-workflow.yml` dela chama com `enable_lint`, `enable_test`, `enable_secrets_scan`) | Um lugar para evoluir CI de todos os backends; os jobs de cargo dos contratos continuam como jobs próprios ao lado                        | M       |
| 12  | Job `test:e2e` com a API subindo no runner contra os mesmos `services:` do item 5, rodando o smoke como spec                                                                   | **Depende** da fatia de testes do harness (smoke virando spec `@e2e`). Sem isso, o fluxo emissão → prova → attestation só é testado à mão | M       |
| 13  | Atualizar `actions/checkout@v3` para `v4` no job `pull-request` e tirar o `sleep 4`                                                                                            | Consistência com os demais jobs; o sleep não tem justificativa no arquivo                                                                 | P       |

## 3. Nota sobre migrations

O `staging-workflow` aplica `yarn prisma:deploy` automaticamente (job `migrate-database`, antes do build da imagem). O `main-workflow` não aplica: em produção a migration é manual. O README foi corrigido para dizer isso; antes afirmava que nenhum pipeline rodava migrations.

## 4. O que já mudou no repo e não precisa de pedido

- `yarn lint` deixou de usar `--fix`. O CI já chama `yarn lint`, então passou a ser um check de verdade sem alterar workflow.
- `yarn lint` também roda `harness:test` (self-test dos hooks nos dois formatos de payload e `catalog:check`). O CI já ganha esses dois sensores sem mudar workflow.
- `yarn deploy:check` compara `env.schema.ts` com os tfvars de staging e prod; roda sem AWS e pode virar passo do CI quando o time de infra quiser.
- `app/.prettierignore` criado; `prettier:check .` deixou de varrer `dist`, `coverage` e o client gerado do Prisma.
