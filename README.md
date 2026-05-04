# Backend Template

Template de backend NestJS para projetos da HOUS3. Focado em boas práticas, padrões consistentes e clareza arquitetural.

## Pré-requisitos

- Node.js 22+
- npm ou yarn

## Como rodar

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env  # Ajuste conforme necessário

# Rodar migrations
npm run prisma:migrate

# Iniciar em desenvolvimento
npm run start:dev
```

A API estará disponível em `http://localhost:3000` e a documentação em `http://localhost:3000/docs`.

## Documentação

A documentação do projeto está organizada em `docs/`:

| Documento                                        | Conteúdo                                             |
| ------------------------------------------------ | ---------------------------------------------------- |
| [docs/README.md](docs/README.md)                 | Índice da documentação                               |
| [docs/architecture.md](docs/architecture.md)     | Princípios arquiteturais (DDD, CQRS, Repo/DAP, etc.) |
| [docs/modules.md](docs/modules.md)               | Padrão de módulos, User, estrutura de pastas         |
| [docs/hooks.md](docs/hooks.md)                   | Webhooks: rota, responder rápido, idempotência       |
| [docs/infrastructure.md](docs/infrastructure.md) | Database, logging Ingress/Egress, env                |
| [docs/infra/gateways.md](docs/infra/gateways.md) | Gateways: ports, factories, adapters, troca de provider |
| [docs/testing.md](docs/testing.md)               | Estratégia de testes                                 |

**Novo no projeto?** Comece pelo [docs/README.md](docs/README.md).

## Scripts principais

| Script                     | Descrição                  |
| -------------------------- | -------------------------- |
| `npm run start:dev`        | Inicia em modo watch       |
| `npm run test:unit`        | Testes unitários           |
| `npm run test:integration` | Testes de integração       |
| `npm run test:e2e`         | Testes E2E (requer Docker) |
| `npm run prisma:migrate`   | Cria migrações e aplica    |
