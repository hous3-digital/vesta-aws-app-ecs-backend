# Vesta Backend — AWS ECS

API backend do ecossistema Vesta. Emite credenciais verificaveis (VCs), gera provas zero-knowledge (Groth16) e submete verificacoes on-chain na blockchain Stellar Soroban.

## Stack

| Camada     | Tecnologia                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Runtime    | Node.js 22                                                                                                 |
| Framework  | NestJS 11                                                                                                  |
| Linguagem  | TypeScript 5.9                                                                                             |
| Banco      | PostgreSQL 16 (Prisma 7)                                                                                   |
| Cache      | Redis 7 (challenges WebAuthn e sessoes de prepare)                                                         |
| Blockchain | Stellar Soroban (SDK 15), contratos Rust em `app/contracts/`                                               |
| ZK Proofs  | snarkjs 0.7 + circomlibjs (Groth16 / BN254)                                                                |
| Auth       | API key (issuers), JWT (backoffice), secret (admin), passkeys WebAuthn e Privy custom auth (usuario final) |
| Infra      | AWS ECS Fargate + ALB + RDS                                                                                |
| CI/CD      | GitHub Actions + Terraform 1.14                                                                            |

> Agentes de codigo (Cursor, Claude Code) leem o [`AGENTS.md`](AGENTS.md): regras invioaveis, estrutura alvo de modulo, mapa de legado e camadas de teste.

---

## Arquitetura

```
app/src/
├── modules/
│   ├── backoffice/      # Painel do issuer: credenciais, verificacoes, comissoes, perfil, verifiers, API keys
│   ├── challenge/       # Challenges WebAuthn (anti-replay), passkeys e recuperacao de credencial
│   ├── commission/      # Ledger de comissoes, payouts e registro on-chain (Soroban)
│   ├── credential/      # Emissao, verificacao, revogacao e status de KYC das VCs (CQRS)
│   ├── issuer/          # Issuers, DID (did:stellar) e registry on-chain
│   ├── proof/           # Provas ZK, prepare/submit on-chain e attestations (CQRS)
│   ├── stellar/         # Adapter do Stellar Soroban (unico lugar que deve importar o SDK)
│   ├── vc/              # Construcao de Verifiable Credentials (W3C)
│   ├── wallet/          # Wallets Privy, JWKS e custom auth
│   └── zk/              # Orquestracao de provas Groth16 (worker process)
├── infra/
│   ├── auth/            # Guards e controllers de API key, backoffice (JWT) e admin (secret)
│   ├── database/        # Prisma ORM, schema, migrations, seeds
│   ├── env/             # Validacao de env vars (Zod)
│   ├── http/            # CORS
│   └── logging/         # Logs de ingress/egress (request/response)
├── shared/              # Eventos, tipos (VestaVC), validadores e value objects (Id/TypeID)
├── utils/               # Decorators, helpers, interceptors (envelope { data }), subscribers
├── scripts/             # Deploy do payout vault
├── app.module.ts
├── main.ts
└── health.controller.ts
```

### Padrao DDD + CQRS

Estrutura alvo de um modulo. Hoje so `credential` e `proof` seguem por completo; o estado de cada modulo esta no mapa de legado do [`AGENTS.md`](AGENTS.md).

```
module/
├── api/{public,backoffice,admin}/   # Controllers + Input DTOs por contexto (class-validator)
├── application/{public,backoffice,admin,internal}/
│   ├── commands/                    # Command classes
│   ├── queries/                     # Query classes
│   └── handlers/                    # Command/Query handlers (orquestracao)
├── domain/
│   ├── *.entity.ts                  # Entidade rica (TypeID, factory methods, regras)
│   ├── *.value-object.ts
│   └── *.repository.ts              # Interface abstrata (abstract class)
└── infra/
    ├── *.repository.ts              # Implementacao Prisma
    ├── *.mapper.ts                  # Prisma <-> Domain
    ├── *.data-access-object.ts      # Queries de leitura
    └── *.gateway.ts                 # Integracoes (chain, provedores)
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
make db-reset  # apaga e recria o banco LOCAL com as fixtures (le somente app/.env.local)
```

Sem Docker: aponte `DATABASE_URL` do `app/.env.local` para o seu Postgres (usuario `postgres`, banco `vesta_local`) e comente `REDIS_URL` (o challenge cai para Postgres e a sessao de prepare fica em memoria).

Fixtures criadas pelo `make db` (`app/src/infra/database/seeds/local-fixtures.sql`):

| O que          | Valor                                           |
| -------------- | ----------------------------------------------- |
| Issuer         | `local_bank` (`privy_enabled=false`)            |
| API key do SDK | `vesta_live_local_dev_do_not_use_in_production` |
| Backoffice     | `dev@localhost` / `vesta_local`                 |
| Verifier       | `verifier_local`                                |

`make smoke` roda `app/scripts/smoke.mjs`: health, login do backoffice, emissao de credencial, verify, challenge, `prepare` (prova Groth16 real) e `submit-signed` (Stellar mock). Sai com codigo 1 se algum passo falhar.

O `.env` continua sendo o arquivo de staging/producao e nunca deve ser copiado para o `.env.local`. A API le outro arquivo quando `ENV_FILE` esta definido (e o que `yarn start:local` faz).

O `yarn install` tambem ativa o hook de `commit-msg` (husky em `app/.husky`): mensagens de commit fora do padrao Conventional Commits (`app/commitlint.config.js`: tipo da lista fixa, assunto com no minimo 15 caracteres, header ate 100) sao rejeitadas localmente.

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`

---

## Variaveis de ambiente

Fonte de verdade: `app/src/infra/env/env.schema.ts` (Zod). Template local: `app/.env.local.example`.

| Variavel                                                                                      | Obrigatoria | Default                               | Descricao                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                    | Sim         | —                                     | `local` / `test` / `development` / `production`                                                            |
| `PORT`                                                                                        | Nao         | `3000`                                | Porta HTTP                                                                                                 |
| `DATABASE_URL`                                                                                | Sim         | —                                     | Connection string PostgreSQL                                                                               |
| `REDIS_URL`                                                                                   | Nao         | —                                     | Redis para challenges e sessoes de prepare; sem ele, challenge cai para Postgres e prepare fica em memoria |
| `CPF_HMAC_SECRET`                                                                             | Sim         | —                                     | Secret HMAC-SHA256 para dedup de CPF (min 32 chars)                                                        |
| `CORS_ALLOWED_ORIGINS`                                                                        | Nao         | `""`                                  | Origens permitidas, separadas por virgula                                                                  |
| `ADMIN_SECRET`                                                                                | Nao         | —                                     | Secret dos endpoints `/admin/*` (min 32 chars)                                                             |
| `BACKOFFICE_JWT_SECRET`                                                                       | Nao         | —                                     | Assinatura do JWT do backoffice (min 32 chars, diferente do `ADMIN_SECRET`)                                |
| `BACKOFFICE_JWT_EXPIRES_IN`                                                                   | Nao         | `8h`                                  | Validade do JWT do backoffice                                                                              |
| `WEBAUTHN_ALLOWED_ORIGINS`                                                                    | Nao         | —                                     | Origens aceitas nas cerimonias de passkey                                                                  |
| `WEBAUTHN_ALLOWED_RP_IDS`                                                                     | Nao         | `localhost`                           | RP IDs aceitos nas cerimonias de passkey                                                                   |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET`                                                           | Nao         | —                                     | App da Privy (wallets do usuario final). Ausentes em local                                                 |
| `PRIVY_CUSTOM_AUTH_PRIVATE_KEY` / `PRIVY_CUSTOM_AUTH_KEY_ID` / `PRIVY_CUSTOM_AUTH_ISSUER`     | Nao         | issuer `vesta`                        | Custom auth da Privy (JWT ES256 assinado pela API, JWKS em `/.well-known/jwks.json`)                       |
| `STELLAR_RPC_URL`                                                                             | Nao         | `https://soroban-testnet.stellar.org` | URL do Soroban RPC                                                                                         |
| `STELLAR_HORIZON_URL`                                                                         | Nao         | —                                     | URL do Horizon (trustlines e payouts)                                                                      |
| `STELLAR_NETWORK`                                                                             | Nao         | `Test SDF Network ; September 2015`   | Stellar network passphrase                                                                                 |
| `VESTA_CONTRACT_ID`                                                                           | Nao         | `PLACEHOLDER`                         | Contrato verifier (mock se `PLACEHOLDER`)                                                                  |
| `STELLAR_ISSUER_REGISTRY_CONTRACT_ID`                                                         | Nao         | `PLACEHOLDER`                         | Contrato issuer registry (mock se `PLACEHOLDER`)                                                           |
| `STELLAR_PAYOUT_CONTRACT_ID`                                                                  | Nao         | `PLACEHOLDER`                         | Contrato payout vault (mock se `PLACEHOLDER`)                                                              |
| `VESTA_DEPLOYER_SECRET`                                                                       | Nao         | `""`                                  | Secret key da conta deployer Stellar                                                                       |
| `STELLAR_PAYOUT_OPERATOR_SECRET`                                                              | Nao         | `""`                                  | Secret key do operator do payout vault (deve ser distinta da deployer)                                     |
| `STELLAR_PAYOUT_ASSET_CODE` / `STELLAR_PAYOUT_ASSET_ISSUER` / `STELLAR_PAYOUT_ASSET_DECIMALS` | Nao         | `BRL` / — / `7`                       | Ativo Stellar usado nos payouts                                                                            |
| `COMMISSION_PER_VERIFICATION_BRL`                                                             | Nao         | `1.37`                                | Valor da comissao por verificacao                                                                          |
| `COMMISSION_SECURITY_MINUTES`                                                                 | Nao         | `30`                                  | Janela de seguranca antes de uma comissao ficar disponivel                                                 |
| `PAYOUT_PROCESSOR_INTERVAL_MS`                                                                | Nao         | `10000`                               | Intervalo do processador de payouts                                                                        |
| `COMMISSION_REGISTRATION_PROCESSOR_INTERVAL_MS`                                               | Nao         | `10000`                               | Intervalo do registro de comissoes on-chain                                                                |
| `ZK_ARTIFACTS_DIR`                                                                            | Nao         | `./zk-artifacts`                      | Diretorio com .wasm, .zkey e verification_key.json                                                         |
| `ZK_MOCK_MODE`                                                                                | Nao         | `true`                                | `"true"` = provas simuladas, `"false"` = provas reais                                                      |

---

## Endpoints

Tres contextos de autenticacao:

| Prefixo         | Quem chama                                                            | Auth                                |
| --------------- | --------------------------------------------------------------------- | ----------------------------------- |
| `/public/*`     | SDK do issuer (contrato com cliente em producao; nunca muda in place) | Header de API key `vesta_live_*`    |
| `/backoffice/*` | Backoffice web do issuer                                              | JWT (`POST /backoffice/auth/login`) |
| `/admin/*`      | Operacao da Vesta                                                     | `ADMIN_SECRET`                      |

Endpoints publicos (contrato do SDK):

| Metodo | Rota                                                   | Descricao                                                              |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `GET`  | `/health`                                              | Health check                                                           |
| `GET`  | `/public/auth/challenge`                               | Gerar challenge WebAuthn (TTL 60s)                                     |
| `POST` | `/public/auth/passkey/registration/{options,verify}`   | Registro de passkey                                                    |
| `POST` | `/public/auth/passkey/authentication/{options,verify}` | Autenticacao por passkey                                               |
| `POST` | `/public/credential`                                   | Emitir credencial (VC)                                                 |
| `POST` | `/public/credential/verify`                            | Verificar status de uma VC por hash                                    |
| `POST` | `/public/credential/revoke`                            | Revogar uma VC                                                         |
| `POST` | `/public/credential/recover`                           | Recuperar credencial por passkey                                       |
| `POST` | `/public/credential/kyc-status`                        | Webhook de status de KYC do provedor                                   |
| `POST` | `/public/proof/prepare`                                | Fase 1: gera prova ZK e monta a transacao Soroban sem assinatura       |
| `POST` | `/public/proof/submit-signed`                          | Fase 2: recebe a transacao assinada, faz fee-bump e submete ao Soroban |
| `POST` | `/public/proof/submit`                                 | Submeter prova ZK externa (fluxo legado)                               |
| `GET`  | `/public/attestations/:attestationId/issuer`           | Resolver o issuer por tras de uma attestation                          |
| `GET`  | `/.well-known/jwks.json`                               | JWKS da custom auth Privy                                              |

Backoffice (`/backoffice/auth`, `credentials`, `verifications`, `commissions`, `payouts`, `profile`, `api-keys`, `admin/verifiers`) e admin (`/admin/api-keys`, `issuers`, `backoffice-users`, `payout-cycles`) estao descritos com schemas de request/response em **`GET /docs`** (Swagger UI).

---

## Banco de dados

### Models

| Model                             | Tabela                                 | Descricao                                          |
| --------------------------------- | -------------------------------------- | -------------------------------------------------- |
| `Credential`                      | `credentials`                          | Credenciais emitidas (status, vcHash, cpfDedupKey) |
| `PasskeyCredential`               | `passkey_credentials`                  | Passkeys WebAuthn do usuario final                 |
| `AuthChallenge`                   | `auth_challenges`                      | Challenges one-time (fallback quando nao ha Redis) |
| `Attestation`                     | `attestation`                          | Resultados de verificacao on-chain                 |
| `Issuer`                          | `issuer`                               | Emissores cadastrados (DID, registry, Privy)       |
| `ApiKey`                          | `api_keys`                             | API keys dos issuers                               |
| `BackofficeUser`                  | `backoffice_users`                     | Usuarios do backoffice                             |
| `Verifier`                        | `verifier`                             | Verifiers cadastrados                              |
| `OrganizationWallet`              | `organization_wallets`                 | Wallet Stellar do issuer (ativacao, trustline)     |
| `CommissionLedgerEntry`           | `commission_ledger_entries`            | Ledger de comissoes por verificacao                |
| `PayoutRequest` / `PayoutAttempt` | `payout_requests` / `payout_attempts`  | Pedidos de saque e tentativas                      |
| `PayoutCycle` / `PayoutCycleItem` | `payout_cycles` / `payout_cycle_items` | Ciclos de payout e seus itens                      |
| `Ingress`                         | `ingress`                              | Log de requests recebidas                          |
| `Egress`                          | `egress`                               | Log de requests enviadas                           |

### Comandos Prisma

```bash
yarn prisma:gen          # Gerar Prisma Client
yarn prisma:migrate      # Criar migration + aplicar (dev)
yarn prisma:deploy       # Aplicar migrations pendentes (staging/prod)
yarn prisma:reset        # Resetar banco + seed (APAGA DADOS; carrega .env = staging! use make db-reset para o local)
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
yarn test:unit           # __tests__/@unit: entidades e value objects
yarn test:integration    # __tests__/@integration: handlers e services com regra (precisa do Postgres do compose)
yarn test:e2e            # __tests__/@e2e: HTTP contra a API de pe (em reconstrucao: hoje referencia .env.test e docker-compose-test.yaml inexistentes)
yarn test:cov            # Unitarios com coverage
```

Criterio de cada camada em [`AGENTS.md`](AGENTS.md) e [`app/docs/__test__/README.md`](app/docs/__test__/README.md).

---

## ZK Proofs — Mock vs Real

| Modo                   | `ZK_MOCK_MODE` | `VESTA_CONTRACT_ID` | Comportamento                      |
| ---------------------- | -------------- | ------------------- | ---------------------------------- |
| Full mock              | `"true"`       | `PLACEHOLDER`       | Provas e transacoes simuladas      |
| ZK real + Stellar mock | `"false"`      | `PLACEHOLDER`       | Gera prova real, simula blockchain |
| Full real              | `"false"`      | Contract ID real    | Provas reais + transacoes on-chain |

**Artefatos ZK** (em `ZK_ARTIFACTS_DIR`):

| Arquivo                 | Descricao                    |
| ----------------------- | ---------------------------- |
| `vesta_kyc.wasm`        | Circuito compilado           |
| `vesta_kyc_final.zkey`  | Trusted setup key            |
| `verification_key.json` | Chave de verificacao publica |

---

## Deploy (AWS ECS)

### Infraestrutura

| Servico         | Uso                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| ECS Fargate     | Container runtime (blue/green via ALB)                                                                                |
| RDS PostgreSQL  | Banco de dados                                                                                                        |
| ECR             | Registry de imagens Docker                                                                                            |
| Secrets Manager | Segredos do container (definidos por ambiente em `infra/terraform/envs/{staging,prod}`) e chaves da custom auth Privy |
| ALB             | Load balancer com TLS                                                                                                 |
| Terraform 1.14  | Infrastructure as Code                                                                                                |

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

> O `staging-workflow` aplica as migrations automaticamente (job `migrate-database`, antes do build da imagem). O `main-workflow` NAO aplica: em producao execute manualmente antes de deployar mudancas de schema.

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
    ├── POST /public/proof/prepare
    │       │
    │       ├── 1. Consome o challenge (kind, vcHash e issuer precisam bater)
    │       ├── 2. Gera prova Groth16 (worker process)
    │       ├── 3. Verifica prova localmente (snarkjs)
    │       ├── 4. Monta a transacao Soroban sem assinatura
    │       └── 5. Devolve XDR + prepareSessionId (sessao no Redis)
    │
    └── POST /public/proof/submit-signed
            │
            ├── 1. Recupera a sessao de prepare
            ├── 2. Faz fee-bump (Vesta paga a taxa) e submete ao Soroban
            ├── 3. Salva attestation + lancamento no ledger de comissoes
            └── 4. Processador em background registra a comissao on-chain
```

---

## Documentacao adicional

| Documento                                                                                    | Conteudo                                                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                                                                       | Contrato para agentes de codigo: regras, estrutura alvo, mapa de legado, camadas de teste |
| [app/docs/architecture.md](app/docs/architecture.md)                                         | Principios arquiteturais (DDD, CQRS, Repo/DAO)                                            |
| [app/docs/modules/README.md](app/docs/modules/README.md)                                     | Padrao de modulos e estrutura de pastas                                                   |
| [app/docs/infra/README.md](app/docs/infra/README.md)                                         | Database, logging, env, gateways, cipher                                                  |
| [app/docs/**test**/README.md](app/docs/__test__/README.md)                                   | Estrategia de testes                                                                      |
| [app/docs/decisions.md](app/docs/decisions.md)                                               | Decisoes tomadas e pendencias tecnicas (registro vivo)                                    |
| [app/docs/audits/2026-09-auditoria-tecnica.md](app/docs/audits/2026-09-auditoria-tecnica.md) | Auditoria tecnica de setembro/2026                                                        |
| [app/docs/architecture/proposta-v2-2026-09.md](app/docs/architecture/proposta-v2-2026-09.md) | Proposta de arquitetura v2 (parcialmente descontinuada)                                   |
