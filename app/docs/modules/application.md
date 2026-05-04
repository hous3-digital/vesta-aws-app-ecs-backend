# Camada de aplicação (`application/`)

Este documento descreve o **padrão de orquestração** que usamos na camada de aplicação: handlers no estilo **caso de uso**, CQRS (commands vs queries), subdivisão **public / backoffice / internal** e papel das **sagas** na reação a eventos.

---

## Papel da camada

A aplicação **não contém regras de negócio**. Ela **orquestra** o fluxo: chama repositórios e serviços de domínio, monta entidades e value objects, publica eventos e traduz exceções de domínio em erros de aplicação quando necessário.

| Onde fica                      | Exemplos                                                                 |
| ------------------------------ | ------------------------------------------------------------------------ |
| **Domínio** (`domain/`)        | Invariantes, `Entity.create`, validação em VOs, políticas puras          |
| **Aplicação** (`application/`) | “Buscar X, criar Y, salvar, publicar evento Z” — sequência e coordenação |
| **Infra** (`infra/`)           | Prisma, mappers, DAOs                                                    |

Se a regra for “um email não pode se repetir”, ela pode aparecer como invariante no domínio **e** o handler pode consultar o repositório antes de criar — mas a **decisão de negócio** (o que é inválido) continua expressa no domínio; o handler só **ordena** as chamadas.

---

## Um handler = uma ação (caso de uso)

Para cada operação significativa existe **um par** típico:

- **Command** ou **Query** — DTO imutável com os dados da intenção (`UserPublicCreateCommand`, `MembershipPublicFindManyQuery`).
- **Handler** — classe `@CommandHandler` ou `@QueryHandler` que implementa **uma** `execute(...)`.

Isso espelha o padrão **Application Service / Use Case**: nomes explícitos (`UserPublicCreateHandler`, `UserBackofficeDeactivateHandler`) e responsabilidade única facilitam testes e navegação no código.

---

## Subpastas: `public`, `backoffice` e `internal`

A estrutura reflete **quem inicia o fluxo**, não a tecnologia.

### `public/`

Fluxos disparados pela **API pública** (apps, integrações voltadas ao produto). Ex.: registro de usuário, autenticação, listagens expostas ao cliente.

### `backoffice/`

Fluxos disparados pela **API administrativa** — operações de suporte, moderação, configuração. Mesmo padrão de commands/handlers, outra superfície de autorização e contrato HTTP.

### `internal/`

Fluxos **não** iniciados diretamente pelo “usuário final” da API de produto no mesmo sentido dos anteriores. No template, usamos `internal` principalmente para:

1. **Endpoints internos** (ex.: webhooks) que recebem um payload e disparam um command.
2. **Handlers que reagem a eventos** publicados no barramento (via **Saga**), por exemplo após um evento de integração externa.

A ideia é **evitar acoplamento direto** entre módulos: um módulo publica um evento; outro traduz esse evento em um command e um handler aplica as mudanças no domínio, sem o primeiro importar classes do segundo.

---

## Sagas e eventos

Usamos **`@Saga()`** do NestJS CQRS para **reagir a eventos** e emitir **commands**. A saga observa o stream de eventos (`ofType(MeuEvento)`), eventualmente transforma o payload e devolve um `Observable` de um **novo command** que será executado pelo `CommandBus`.

Fluxo típico no template:

1. Um handler (ex.: webhook interno) publica um evento de integração, por exemplo `ExternalVeriffKycReceivedEvent`.
2. Uma **Saga** escuta esse evento e mapeia para `UserInternalUpdateUserStatusByKycVeriffCommand`.
3. O **handler interno** desse command executa o caso de uso (atualizar estado do usuário, etc.).

Isso é o núcleo do padrão **process manager / saga de orquestração leve**: a saga **não** contém regra de negócio pesada — só **roteamento** de “evento X → command Y”. A regra fica no domínio e no handler do command.

Eventos de **domínio** (dentro do agregado) e eventos de **integração** (compartilhados entre módulos) podem coexistir; o importante é documentar no módulo qual evento dispara qual fluxo interno.

---

## Commands vs queries (CQRS neste projeto)

|              | **Command**                                   | **Query**                                                                           |
| ------------ | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Intenção** | Alterar estado do sistema                     | Apenas ler dados                                                                    |
| **Handler**  | `@CommandHandler`                             | `@QueryHandler`                                                                     |
| **Escrita**  | Via **Repository** e **entidades de domínio** | —                                                                                   |
| **Leitura**  | Pode ler para validar antes de escrever       | Via **DAO** (projeções, listagens), sem obrigatoriamente passar por entidades ricas |

Não adotamos “dois bancos” nem event sourcing completo: é **CQRS pragmático** — separação clara de responsabilidades no código. Detalhes de Repository vs DAO estão em [Arquitetura e princípios](../architecture.md).

**Regra prática:**

- Precisa **persistir mudança** em agregado / invariantes → **Command** + repository (e eventos se fizer sentido).
- Precisa **montar tela, lista ou relatório** → **Query** + DAO (leitura otimizada, DTOs de leitura).

---

## O que pode (e não pode) ir no handler

**Pode:**

- Injetar `IUserRepository`, `EventBus`, `CommandBus`, serviços de aplicação/infra autorizados.
- Chamar `Entity.create` / métodos da entidade que encapsulam regras.
- Ordenar passos: validar pré-condição, salvar, publicar evento.
- Lançar `ConflictException`, `NotFoundException`, etc., quando o fluxo de aplicação assim exigir.

**Evite:**

- Colocar **regra de negócio solta** em `if` gigantes no handler — prefira entidade, VO ou serviço de domínio.
- Acessar Prisma ou SQL **direto** no handler de command — use o repositório do domínio; em queries, use o DAO na camada de infra.
- Misturar vários casos de uso no mesmo handler “genérico”.

---

## Convenções de nomes

- **Command:** `{Contexto}{Ação}Command` — ex.: `UserPublicCreateCommand`.
- **Query:** `{Contexto}{Ação}Query` — ex.: `MembershipPublicFindManyQuery`.
- **Handler:** mesmo prefixo do command/query + sufixo `Handler`.

O prefixo (`Public`, `Backoffice`, `Internal`) deixa explícita a **superfície** e o tipo de fluxo.

---

## Integração com a API HTTP

Controllers montam o command ou a query e delegam ao **`CommandBus`** ou **`QueryBus`**. Eles não implementam a orquestração; apenas adaptam HTTP → comando/query e serializam a resposta. Ver [Padrão de controllers (API HTTP)](api.md).

---

## Registro no módulo NestJS

Cada `*Handler` (e sagas, quando existirem) deve ser listado em **`providers`** do módulo do domínio, junto com `CqrsModule`. Sem isso o barramento não encontra o handler.

---

## Resumo

| Conceito                | Neste template                                                               |
| ----------------------- | ---------------------------------------------------------------------------- |
| **Handler**             | Um caso de uso por classe — `execute` orquestra, não define regra de negócio |
| **public / backoffice** | Quem chama pela API (cliente vs admin)                                       |
| **internal**            | Webhooks, integrações e/ou reações a eventos (com sagas)                     |
| **Command**             | Muta estado (repository + domínio)                                           |
| **Query**               | Só leitura (em geral DAO)                                                    |
| **Saga**                | Evento → novo command, sem lógica de domínio pesada                          |

Para a árvore de pastas geral do módulo, veja [README dos módulos](README.md).
