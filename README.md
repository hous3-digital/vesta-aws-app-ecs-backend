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

- **Node.js** >= 22
- **Yarn** 1.x
- **PostgreSQL** 14+
- **Docker** (opcional, para banco local)

---

## Setup local

### 1. Clonar e instalar

```bash
git clone git@github.com:hous3-digital/vesta-aws-app-ecs-backend.git
cd vesta-aws-app-ecs-backend/app
yarn install
```

### 2. Configurar variaveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env`:

```env
NODE_ENV="local"
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vesta_db?schema=public&connect_timeout=300"

# Stellar (testnet)
STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
STELLAR_NETWORK="Test SDF Network ; September 2015"
VESTA_CONTRACT_ID="PLACEHOLDER"
VESTA_DEPLOYER_SECRET=""

# ZK Proofs
ZK_ARTIFACTS_DIR="./zk-artifacts"
ZK_MOCK_MODE="true"

# CPF dedup — gerar com: openssl rand -hex 32
CPF_HMAC_SECRET="cole-aqui-o-resultado-do-openssl-rand-hex-32"
```

### 3. Subir o banco

```bash
yarn docker:up
```

Ou conecte a um PostgreSQL existente atualizando o `DATABASE_URL`.

### 4. Migrations e Prisma Client

```bash
yarn prisma:gen       # Gerar Prisma Client
yarn prisma:migrate   # Criar e aplicar migrations
```

### 5. Iniciar o servidor

```bash
yarn start:dev
```

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
