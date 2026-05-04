# Infraestrutura

Padrão da camada **`src/infra/`**: detalhes técnicos (banco, env, JWT, logs HTTP, gateways) **fora** do domínio. Módulos de negócio dependem de **interfaces**; implementações concretas e integrações ficam aqui.

## Estrutura (visão geral)

```
src/infra/
├── cipher/          # JWT (assinatura / tokens)
├── database/        # Prisma, PrismaService, providers de repos/DAOs, seeds
├── env/             # Config validada (Zod) + EnvService
├── gateways/        # Ports + providers (APIs externas)
└── logging/
    ├── ingress/     # Log de requisições recebidas
    └── egress/      # Client HTTP + log de requisições enviadas
```

## Guias por tema

### Cipher

**Responsabilidade:** JWT — módulo que configura `@nestjs/jwt` com segredo do ambiente e tipo de payload.

**Guia detalhado:** [Cipher (JWT)](cipher.md)

---

### Database

**Responsabilidade:** PostgreSQL via Prisma (adapter `pg`), `DatabaseModule`, bindings de repositórios/DAOs, migrations e seeds.

**Guia detalhado:** [Database](database.md)

---

### Env

**Responsabilidade:** Variáveis de ambiente validadas (`env.schema.ts`) e acesso tipado via `EnvService`.

**Guia detalhado:** [Env](env.md)

---

### Gateways

**Responsabilidade:** Integrações com APIs de terceiros — portas (`I…Port`), factories, adapters por provedor, HTTP via `EgressService` quando aplicável.

**Guia detalhado:** [Gateways](gateways.md)

---

### Logging (Ingress / Egress)

**Responsabilidade:** Persistir tráfego HTTP — entrada (`IngressLogger` + tabela `ingress`) e saída (`EgressService` + tabela `egress`).

**Guia detalhado:** [Logging HTTP](logging.md)

---

## Resumo

| Componente   | Localização                  | Documentação               |
| ------------ | ---------------------------- | -------------------------- |
| Cipher (JWT) | `src/infra/cipher/jwt/`      | [cipher.md](cipher.md)     |
| Database     | `src/infra/database/`        | [database.md](database.md) |
| Env          | `src/infra/env/`             | [env.md](env.md)           |
| Gateways     | `src/infra/gateways/`        | [gateways.md](gateways.md) |
| Ingress      | `src/infra/logging/ingress/` | [logging.md](logging.md)   |
| Egress       | `src/infra/logging/egress/`  | [logging.md](logging.md)   |

**Fluxo típico de integração externa:** variáveis em **Env** → chamada via **Egress** (e/ou SDK) dentro de um **Gateway** → contrato estável na **Port**. Autenticação com token assinado usa **Cipher** e segredo do **Env**.
