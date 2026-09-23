# Vesta Backend — AWS ECS

API backend do ecossistema Vesta. Emite credenciais verificaveis (VCs), gera provas zero-knowledge (Groth16) e submete verificacoes on-chain na blockchain Stellar Soroban.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 22 |
| Framework | NestJS 11 |
| Linguagem | TypeScript 5.9 |
| Banco | PostgreSQL (Prisma 7) |
| Blockchain | Stellar Soroban (SDK 15) |
| ZK Proofs | snarkjs 0.7 + circomlibjs |
| Infra | AWS ECS Fargate + ALB + RDS |
| CI/CD | GitHub Actions + Terraform 1.14 |

---

## Arquitetura

```
app/src/
├── modules/
│   ├── challenge/       # Geracao de challenges WebAuthn (anti-replay)
│   ├── credential/      # Emissao, verificacao e revogacao de VCs (CQRS)
│   ├── proof/           # Geracao de provas ZK e submissao on-chain (CQRS)
│   ├── stellar/         # Integracao com Stellar Soroban
│   ├── vc/              # Construcao de Verifiable Credentials (W3C)
│   └── zk/              # Orquestracao de provas Groth16 (worker process)
├── infra/
│   ├── database/        # Prisma ORM, schema, migrations, seeds
│   ├── env/             # Validacao de env vars (Zod)
│   └── logging/         # Logs de ingress/egress (request/response)
├── shared/
│   ├── types/           # Interfaces compartilhadas (VestaVC, etc)
│   └── value-objects/   # Id (TypeID), etc
├── utils/
│   ├── interceptors/    # ApiTransformInterceptor (envelope { data })
│   └── subscribers/     # GlobalUnhandledException
├── app.module.ts
├── main.ts
└── health.controller.ts
```

### Padrao DDD + CQRS

Cada modulo com persistencia (`credential`, `proof`) segue:

```
module/
├── api/public/              # Controllers + Input DTOs (class-validator)
├── application/public/
│   ├── commands/            # Command classes
│   ├── queries/             # Query classes
│   └── handlers/            # Command/Query handlers (logica de negocio)
├── domain/
│   ├── entity.ts            # Entidade rica (TypeID, factory methods)
│   └── repository.ts        # Interface abstrata (abstract class)
└── infra/
    ├── repository.ts        # Implementacao Prisma
    ├── mapper.ts            # Prisma <-> Domain
    └── data-access-object.ts # Queries de leitura
```

---

## Pre-requisitos

- **Node.js** >= 22 (com `corepack enable`; o `packageManager` do `app/package.json` fixa o Yarn 1.22)
- **Docker** com Compose v2 (Postgres e Redis locais) ou um PostgreSQL 14+ nativo
- **make**

---

## Setup local

O ambiente local roda **sem Privy e sem contratos reais**: ZK real (artefatos versionados em `app/zk-artifacts`) e Stellar em modo mock (`VESTA_CONTRACT_ID=PLACEHOLDER`). Nenhuma transacao sai da maquina e nada de staging e usado.

```bash
git clone git@github.com:hous3-digital/vesta-aws-app-ecs-backend.git
cd vesta-aws-app-ecs-backend
(cd app && yarn install)

make env    # cria app/.env.local a partir de app/.env.local.example
make up     # Postgres + Redis via app/docker-compose.yml
make db     # prisma generate + migrations + seeds (fixtures locais)
make dev    # API em watch lendo app/.env.local
make smoke  # em outro terminal: fluxo completo emissao -> prova -> attestation
```

Sem Docker: aponte `DATABASE_URL` do `app/.env.local` para o seu Postgres (usuario `postgres`, banco `vesta_local`) e comente `REDIS_URL` (o challenge cai para Postgres e a sessao de prepare fica em memoria).

Fixtures criadas pelo `make db` (`app/src/infra/database/seeds/local-fixtures.sql`):

| O que | Valor |
|---|---|
| Issuer | `local_bank` (`privy_enabled=false`) |
| API key do SDK | `vesta_live_local_dev_do_not_use_in_production` |
| Backoffice | `dev@localhost` / `vesta_local` |
| Verifier | `verifier_local` |

`make smoke` roda `app/scripts/smoke.mjs`: health, login do backoffice, emissao de credencial, verify, challenge, `prepare` (prova Groth16 real) e `submit-signed` (Stellar mock). Sai com codigo 1 se algum passo falhar.

O `.env` continua sendo o arquivo de staging/producao e nunca deve ser copiado para o `.env.local`. A API le outro arquivo quando `ENV_FILE` esta definido (e o que `yarn start:local` faz).

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`

---

## Variaveis de ambiente

| Variavel | Obrigatoria | Default | Descricao |
|----------|-------------|---------|-----------|
| `NODE_ENV` | Sim | — | `local` / `test` / `development` / `production` |
| `PORT` | Nao | `3000` | Porta HTTP |
| `DATABASE_URL` | Sim | — | Connection string PostgreSQL |
| `CPF_HMAC_SECRET` | Sim | — | Secret HMAC-SHA256 para dedup de CPF (min 32 chars) |
| `STELLAR_RPC_URL` | Nao | `https://soroban-testnet.stellar.org` | URL do Soroban RPC |
| `STELLAR_NETWORK` | Nao | `Test SDF Network ; September 2015` | Stellar network passphrase |
| `VESTA_CONTRACT_ID` | Nao | `PLACEHOLDER` | Contract ID Soroban (mock se `PLACEHOLDER`) |
| `VESTA_DEPLOYER_SECRET` | Nao | `""` | Secret key da conta deployer Stellar |
| `ZK_ARTIFACTS_DIR` | Nao | `./zk-artifacts` | Diretorio com .wasm, .zkey e verification_key.json |
| `ZK_MOCK_MODE` | Nao | `true` | `"true"` = provas simuladas, `"false"` = provas reais |

---

## Endpoints

| Metodo | Rota | Descricao |
|--------|------|-----------|
| `GET` | `/health` | Health check |
| `GET` | `/public/auth/challenge` | Gerar challenge WebAuthn (TTL 60s) |
| `POST` | `/public/credential` | Emitir credencial (VC) |
| `POST` | `/public/credential/verify` | Verificar status de uma VC por hash |
| `POST` | `/public/credential/revoke` | Revogar uma VC |
| `POST` | `/public/proof/generate-and-submit` | Gerar prova ZK + submeter ao Soroban |
| `POST` | `/public/proof/submit` | Submeter prova ZK externa ao Soroban |

Documentacao completa com schemas de request/response: **`GET /docs`** (Swagger UI).

---

## Banco de dados

### Models

| Model | Tabela | Descricao |
|-------|--------|-----------|
| `Credential` | `credentials` | Credenciais emitidas (status, vcHash, cpfDedupKey) |
| `Attestation` | `attestation` | Resultados de verificacao on-chain |
| `Issuer` | `issuer` | Emissores cadastrados |
| `Ingress` | `ingress` | Log de requests recebidas |
| `Egress` | `egress` | Log de requests enviadas |

### Comandos Prisma

```bash
yarn prisma:gen          # Gerar Prisma Client
yarn prisma:migrate      # Criar migration + aplicar (dev)
yarn prisma:deploy       # Aplicar migrations pendentes (staging/prod)
yarn prisma:reset        # Resetar banco + seed (APAGA DADOS)
```

---

## Scripts

### Desenvolvimento

```bash
yarn start:dev           # Dev com hot reload
yarn start:debug         # Dev com debugger
yarn lint                # ESLint + auto-fix
yarn prettier:format     # Formatar codigo
```

### Build e producao

```bash
yarn build               # Compilar TypeScript
yarn start:prod          # Rodar build compilado
```

### Testes

```bash
yarn test:unit           # Testes unitarios
yarn test:integration    # Testes de integracao (precisa de banco)
yarn test:e2e            # Testes E2E (sobe Docker automaticamente)
yarn test:cov            # Unitarios com coverage
```

---

## ZK Proofs — Mock vs Real

| Modo | `ZK_MOCK_MODE` | `VESTA_CONTRACT_ID` | Comportamento |
|------|----------------|---------------------|---------------|
| Full mock | `"true"` | `PLACEHOLDER` | Provas e transacoes simuladas |
| ZK real + Stellar mock | `"false"` | `PLACEHOLDER` | Gera prova real, simula blockchain |
| Full real | `"false"` | Contract ID real | Provas reais + transacoes on-chain |

**Artefatos ZK** (em `ZK_ARTIFACTS_DIR`):

| Arquivo | Descricao |
|---------|-----------|
| `vesta_kyc.wasm` | Circuito compilado |
| `vesta_kyc_final.zkey` | Trusted setup key |
| `verification_key.json` | Chave de verificacao publica |

---

## Deploy (AWS ECS)

### Infraestrutura

| Servico | Uso |
|---------|-----|
| ECS Fargate | Container runtime (blue/green via ALB) |
| RDS PostgreSQL | Banco de dados |
| ECR | Registry de imagens Docker |
| Secrets Manager | `DATABASE_URL`, `VESTA_CONTRACT_ID`, `VESTA_DEPLOYER_SECRET`, `CPF_HMAC_SECRET` |
| ALB | Load balancer com TLS |
| Terraform 1.14 | Infrastructure as Code |

### Pipeline CI/CD

Push na branch `staging` dispara automaticamente:

1. **Terraform CI** — format check + plan
2. **Terraform CD** — apply infra
3. **Build & Push** — Docker build + push para ECR (tag: SHA + latest)
4. **Blue/Green Deploy** — update ECS + switch ALB listener
5. **Rollback automatico** se o deploy falhar

### Aplicar migrations em staging/producao

```bash
DATABASE_URL="postgresql://..." yarn prisma:deploy
```

> O pipeline NAO roda migrations automaticamente. Execute manualmente antes de deployar mudancas de schema.

### Docker local

```bash
cd app
docker build -t vesta-backend .
docker run -p 3000:3000 --env-file .env vesta-backend
```

Health check: `GET http://127.0.0.1:3000/health` (30s interval, 3 retries).

---

## Fluxo de dados

```
Cliente (SDK)
    │
    ├── POST /public/credential ──────────► Emite VC + salva no banco
    │                                        (HMAC-SHA256 do CPF como dedup key)
    │
    ├── POST /public/credential/verify ───► Consulta status da VC por vcHash
    │
    ├── GET /public/auth/challenge ───────► Gera challenge one-time (60s TTL)
    │
    └── POST /public/proof/generate-and-submit
            │
            ├── 1. Valida challenge WebAuthn
            ├── 2. Gera prova Groth16 (worker process)
            ├── 3. Verifica prova localmente (snarkjs)
            ├── 4. Submete ao contrato Soroban
            └── 5. Salva attestation no banco
```

---

## Documentacao adicional

| Documento | Conteudo |
|-----------|---------|
| [docs/architecture.md](docs/architecture.md) | Principios arquiteturais (DDD, CQRS, Repo/DAP) |
| [docs/modules.md](docs/modules.md) | Padrao de modulos e estrutura de pastas |
| [docs/infrastructure.md](docs/infrastructure.md) | Database, logging, env |
| [docs/testing.md](docs/testing.md) | Estrategia de testes |
