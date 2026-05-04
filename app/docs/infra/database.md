# Database (Prisma, módulo e persistência)

A infraestrutura de **banco de dados** usa **PostgreSQL**, **Prisma 7** com **driver adapter** (`@prisma/adapter-pg`) e um **`DatabaseModule`** que agrega `PrismaService`, repositórios e DAOs.

---

## Onde fica o quê

| Área                                        | Caminho                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| Schema Prisma                               | `src/infra/database/@prisma/schema.prisma`                      |
| Client gerado                               | `src/infra/database/@prisma/generated/`                         |
| Config Prisma CLI (migrate, generate, seed) | `src/infra/database/@prisma/prisma.config.ts`                   |
| Serviço Nest (`PrismaClient` + adapter)     | `src/infra/database/@prisma/prisma.service.ts`                  |
| Módulo e providers                          | `src/infra/database/database.module.ts`, `database.provider.ts` |
| Seeds e SQL auxiliar                        | `src/infra/database/seeds/`                                     |
| Diagrama DBML (gerado)                      | `src/infra/database/@prisma/dbml/`                              |

---

## Prisma e PostgreSQL

- **Datasource:** PostgreSQL; URL em **`DATABASE_URL`** (validada no env).
- **Generator:** `prisma-client` com output em `./generated` (imports devem apontar para o client gerado do projeto).
- **Relações:** `relationMode = "prisma"` no schema — comportamento de relações conforme documentação Prisma para esse modo.

### Adapter e `PrismaService`

O `PrismaService` estende `PrismaClient` e no construtor passa:

- **`adapter: new PrismaPg({ connectionString: envService.DATABASE_URL })`** — conexão via `pg` + adapter oficial.

**Logs de query:**

- Em **produção** e **test**, o array `log` do Prisma fica **`undefined`** (menos ruído).
- Fora disso, há evento `query` no stdout com query “expandida” e duração (útil em desenvolvimento local).

**Ciclo de vida:** `onModuleInit` conecta; `onModuleDestroy` desconecta. Existe `enableShutdownHooks(app)` para encerrar a aplicação no `beforeExit` do Prisma, se for usado no `main.ts`.

---

## `DatabaseModule` e `database.provider.ts`

- **`DatabaseModule`** exporta a lista **`DatabaseProviders`** — não é global; importe onde precisar de repositórios/Prisma.
- **`database.provider.ts`** é o **único lugar** onde se faz o binding de interfaces de domínio para implementações:
  - **`PrismaService`** — acesso direto ao Prisma (usar com parcimônia em handlers; preferir repositórios).
  - **Repositórios** — padrão `{ provide: IUserRepository, useClass: UserRepository }`.
  - **DAOs** — classes de leitura/listagem (`UserDataAccessObject`, etc.), registradas como providers concretos.

Assim, o domínio continua dependendo de **interfaces**; a montagem concreta fica centralizada na infra.

---

## Migrations e scripts (`package.json`)

Comandos usam **`--config src/infra/database/@prisma/prisma.config.ts`**:

| Script           | Função                                    |
| ---------------- | ----------------------------------------- |
| `prisma:gen`     | Gera o client                             |
| `prisma:migrate` | Desenvolvimento — cria/aplica migrations  |
| `prisma:deploy`  | CI/prod — aplica migrations pendentes     |
| `prisma:reset`   | Reset + seed (cuidado em ambientes reais) |

O `prisma.config.ts` define também o **comando de seed** (TypeScript com `ts-node` e paths).

---

## Seeds

O entrypoint é **`src/infra/database/seeds/index.ts`**. Ordem típica:

1. **`functions.sql`** — funções PostgreSQL (parse e execução bloco a bloco).
2. **`base.seed.sql`** — dados mínimos sempre necessários.
3. **`dev.seed.sql`** — só se `NODE_ENV` for `local` ou `development`.
4. **`e2e.seed.sql`** — só se `NODE_ENV === "test"` (referenciado em `seeds/index.ts`; adicione o arquivo quando for usar seed dedicado a E2E).

O seed usa um `PrismaClient` próprio com o mesmo adapter `PrismaPg`, lendo `DATABASE_URL` do processo.

---

## Tabelas de auditoria HTTP (`ingress` / `egress`)

O schema inclui modelos **`Ingress`** e **`Egress`** — armazenam JSON de request/response para tráfego **entrada** (ex.: webhooks) e **saída** (HTTP externo). Detalhes de uso em [logging.md](logging.md).

---

## Nuances e decisões

| Tema                            | Detalhe                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Quem implementa repositório** | Módulos de domínio em `modules/<x>/infra/*.repository.ts`, registrados em `database.provider.ts`.               |
| **DAOs**                        | Queries de leitura que não precisam hidratar entidade de domínio completa; ficam ao lado do módulo.             |
| **Import do client**            | Usar o path do client gerado do repo (ex.: `@src/infra/database/@prisma/generated/client`) conforme `tsconfig`. |
| **Testes**                      | Scripts `prisma:migrate:test` / `prisma:reset:test` usam `.env.test` e Docker de teste quando configurado.      |

---

## Checklist ao mudar o schema

- Rodar **`prisma:gen`** após alterar `schema.prisma`.
- Criar migration em dev com **`prisma:migrate`**.
- Atualizar seeds se houver dados obrigatórios novos.
- Revisar bindings em **`database.provider.ts`** se surgirem novos repositórios/DAOs.
