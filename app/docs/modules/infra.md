# Camada `infra/`

Este documento descreve o **padrão da camada de infraestrutura** nos módulos de domínio (`src/modules/*/infra/`) e como ela se relaciona com a infraestrutura global (`src/infra/`).

---

## Por que essa camada existe

O domínio define **o quê** precisa ser persistido e **com quais regras** (interfaces de repositório, entidades, invariantes), mas **não** escolhe banco, ORM ou formato de tabela. A camada `infra/` é onde essas decisões técnicas ficam concentradas.

**O que ela ajuda a fazer:**

- **Inversão de dependência** — O `domain/` depende de abstrações (`IUserRepository`); `infra/` fornece a implementação concreta. Assim, regras de negócio não importam Prisma nem tipos gerados pelo banco.
- **Um único lugar para “detalhes chatos”** — Conexão, queries específicas do Prisma, mapeamento de colunas para value objects e agendamentos ficam isolados. Se trocar ORM ou schema, a maior parte do impacto fica em `infra/`.
- **Testes** — No domínio e na aplicação você pode mockar interfaces; em testes de integração você exercita repositórios/DAOs reais quando fizer sentido.

Em resumo: **`infra/` é a fronteira entre o sistema de negócio e o mundo externo técnico** (persistência, filas, APIs de terceiros, jobs por tempo).

---

## O que concentramos em `infra/`

### Dentro de cada módulo (`modules/<nome>/infra/`)

| Artefato                     | Papel                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **`*repository.ts`**         | Implementa a interface do domínio; orquestra leitura/escrita em agregados e usa o **mapper** para converter para/de entidades. |
| **`*mapper.ts`**             | Traduz entre modelo de persistência (ex.: tipos Prisma) e entidades de domínio (value objects, enums de domínio).              |
| **`*data-access-object.ts`** | Queries de **leitura** otimizadas para telas, listas e projeções — caminho “Query” do CQRS leve do projeto.                    |

---

## Repositórios (`*repository.ts`)

**Responsabilidade:** cumprir o contrato definido em `domain/*.repository.ts` — carregar e persistir **entidades de domínio** respeitando o modelo de agregado.

- Usam **Prisma** (ou outro client) para `find`, `create`, `update`, etc.
- Devolvem **`User`**, **`Membership`**, etc., nunca “só o row cru” sem passar pelo mapper quando a saída é domínio.
- Erros como “não encontrado” podem ser traduzidos aqui (`NotFoundException`) conforme o padrão do projeto.

Exemplo de ideia (fluxo): `prisma.user.findUnique` → `UserMapper.toDomain(prismaRow)` → `User`.

Isso mantém os **handlers de command** falando apenas com interfaces e entidades, sem conhecer tabelas.

---

## Mappers (`*mapper.ts`)

**Responsabilidade:** conversão **bidirecional** (ou explícita em cada direção) entre:

- **Persistência** — tipos gerados pelo Prisma (`User as UserPrisma`, etc.), nomes de colunas, nullability.
- **Domínio** — entidades reconstruídas com `restore`, value objects (`Id`, `Name`, `Password`), e status alinhados ao tipo do domínio.

**Por que isso é importante:**

- O **domínio não depende** de `@prisma/client`. Se o schema mudar, você ajusta principalmente o mapper (e talvez o repositório), não as entidades em todo lugar.
- **Regras de montagem** ficam num único lugar: por exemplo, garantir que `email` vindo do banco alimente a entidade da forma esperada, ou que enums do Prisma sejam tratados como enums/tipos do domínio.
- Evita **vazamento** de detalhes de banco para `application/` — handlers continuam recebendo objetos de domínio ricos.

Padrão comum no template: métodos estáticos `toDomain(persistência)` e `toJSON` ou equivalente para persistir a entidade (`UserMapper.toJSON(user)`).

---

## DAO — Data Access Object (`*data-access-object.ts`)

**Responsabilidade:** operações de **leitura** que não precisam carregar um agregado completo nem executar invariantes de escrita — listagens paginadas, buscas com filtros, joins para montar **projeções** para API/tela.

**Diferença em relação ao repositório** (alinhado ao [CQRS no projeto](../architecture.md)):

|            | Repository                          | DAO                                                            |
| ---------- | ----------------------------------- | -------------------------------------------------------------- |
| Uso típico | Commands, persistência de entidades | Queries, telas, relatórios                                     |
| Retorno    | Entidade de domínio                 | Estrutura “plana” ou tipos próximos ao Prisma / DTO de leitura |
| Objetivo   | Manter consistência do agregado     | Performance e forma conveniente para o consumidor da query     |

Exemplos no template:

- `UserDataAccessObject.search` — paginação, `count`, `findMany`, retorno com metadados de página (não precisa ser `User` completo para uma lista de backoffice).
- `MembershipDataAccessObject.search` — `include` de `role` e `user` e mapeamento inline para um objeto simples (`roleName`, `userEmail`, etc.).

**Por que não usar só o repositório para tudo?** Forçar tudo por entidade de domínio em listagens grandes tende a **over-fetch**, acoplar a listagem a invariantes que não importam na leitura e misturar “tela” com “modelo de escrita”. O DAO deixa explícito que é um **caminho de leitura**.

---

## Crons e tarefas agendadas

**O que é:** um **cron** (ou _scheduled task_) é um job que o sistema executa **em horários fixos ou intervalos** (por exemplo, todo dia às 3h, a cada 5 minutos), sem depender de um request HTTP. No ecossistema NestJS isso costuma usar `@nestjs/schedule` (`@Cron`, `@Interval`, `@Timeout`).

**Por que concentrar em infra (e não no `domain/`):**

- Disparo por tempo é um **detalhe de entrega** — o domínio descreve regras; “rodar às 2h” é infraestrutura.
- Crons costumam **orquestrar** casos de uso (chamar application services, repositórios, integrações), igual a um controller, mas o gatilho é o relógio em vez do HTTP.

**Por que existe no template:** o `ScheduleModule` está registrado na aplicação para permitir esses jobs quando forem necessários. Ainda não há classes `@Cron` nos módulos — quando forem adicionadas, o lugar natural é:

- **`modules/<nome>/infra/...`** para rotinas **específicas daquele contexto** (ex.: expirar recursos daquele módulo), desde que o job apenas delegue a handlers/serviços e não duplique regra de negócio.

**Boas práticas:** manter o corpo do cron **fino** — validar dependências, chamar um método de aplicação ou um caso de uso, tratar erros e observabilidade. A regra de negócio continua em `domain/` e `application/`.

---

## Resumo

| Peça                     | Onde                            | Função                                         |
| ------------------------ | ------------------------------- | ---------------------------------------------- |
| Interface do repositório | `domain/*.repository.ts`        | Contrato para persistência de agregados        |
| Implementação            | `infra/*.repository.ts`         | Prisma + mapper → entidades                    |
| Mapper                   | `infra/*.mapper.ts`             | Persistência ↔ domínio                         |
| DAO                      | `infra/*.data-access-object.ts` | Leituras e projeções (queries)                 |
| Crons (quando existirem) | `infra/` (global ou do módulo)  | Execução periódica; delega à aplicação/domínio |

Assim, a camada `infra/` **implementa** o que o domínio **promete** e **oferece** caminhos de leitura e integração técnica sem poluir regras de negócio nem contratos HTTP.
