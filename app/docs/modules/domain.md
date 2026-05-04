# Camada de domínio

Este documento descreve o **padrão da camada de domínio** neste template: onde ficam entidades, eventos, contratos de persistência e serviços de domínio, e **por que** essa separação existe.

---

## Papel da camada

O domínio é o lugar em que a **regra de negócio** vive de forma explícita e testável. Aqui não se orquestra fluxo HTTP nem se fala com banco de dados: isso fica na aplicação e na infraestrutura. Aqui definimos **o que é válido** para o negócio (invariantes), **como um conceito muda de estado** e **quais contratos** o restante do sistema deve respeitar para persistir ou integrar esse conhecimento.

| Onde fica                      | Exemplos                                                           |
| ------------------------------ | ------------------------------------------------------------------ |
| **Domínio** (`domain/`)        | Entidades, eventos de domínio, `I*Repository`, serviços de domínio |
| **Aplicação** (`application/`) | Handlers que chamam repositórios, publicam eventos, ordenam passos |
| **Infra** (`infra/`)           | Implementação de repositórios, Prisma, mappers                     |

---

## O que concentramos aqui

### Eventos de domínio (`events/`)

Os eventos **traduzem mudanças de estado** que já ocorreram na entidade ou no agregado. Eles não “fazem” a mudança; descrevem um fato do domínio que outros pontos do sistema podem reagir (sagas, handlers internos, integrações).

- São classes pequenas (em geral estendem `BaseEvent` e carregam identificadores relevantes, como `Id`).
- O nome costuma refletir o passado: _UserCreated_, _MembershipDeactivated_ — algo que **já aconteceu**.
- A entidade pode expor algo como `toEvent()` para mapear o estado atual ao evento correspondente, mantendo a regra “qual evento representa este estado” junto do modelo.

Assim, a **mudança de estado** continua na entidade; o **anúncio** do fato para fora do agregado fica modelado de forma explícita.

### Entidades (`*.entity.ts`)

As entidades **concentram a regra de negócio** do conceito que representam: criação válida, transições de estado, validações que são invariantes do modelo (por exemplo, “não pode desativar duas vezes”).

- Preferimos construtor **privado** e fábricas **`create`** (novo) e **`restore`** (reidratar a partir da persistência).
- Estado mutável é exposto com cuidado (getters); transições passam por **métodos de comportamento** (`activate`, `deactivate`, `ensure…`), não por setters soltos.
- Value objects compartilhados (`Name`, `Password`, `Id`, etc.) reforçam validação e tipagem no domínio.

### Contratos: repositórios e serviços de domínio (`*.repository.ts`, serviços abstratos)

- **Repositório (`IUserRepository`, `IMembershipRepository`, …):** interface que diz **o que** o domínio precisa da persistência (`findByIdOrThrow`, `saveOrThrow`, …), sem SQL, sem ORM. A implementação concreta mora em `infra/`.
- **Serviço de domínio (ex.: `IAuthService`):** quando uma capacidade não pertence naturalmente a uma única entidade mas ainda é regra/capacidade de domínio (gerar token, política que cruza poucos conceitos), expressamos como **interface abstrata** no domínio e implementamos na infra ou em um adaptador.

Isso mantém o domínio **livre de detalhes técnicos** e permite trocar persistência ou integrações sem reescrever regras.

---

## Padrão de entidades que usamos e por que importa

Usamos entidades no estilo **rico**, não anêmicas:

1. **Invariantes dentro da entidade** — Regras como “só pode desativar se ainda está ativo” ou validações de estado ficam em métodos da própria entidade, não espalhadas em handlers.
2. **Fábricas explícitas** — `create` garante um estado inicial consistente; `restore` reconstrói a partir dos dados persistidos sem duplicar lógica de “como nasce um usuário”.
3. **Comportamento nomeado** — Em vez de alterar campos de fora, expomos `deactivate()`, `ensureIsDeactivable()`, etc., para que qualquer mudança passe pelas mesmas regras.

**Por que isso importa:** o modelo de negócio fica **legível e único**. Quem abre `User` ou `Membership` vê o contrato completo daquele conceito. Testes unitários podem exercitar regras sem subir aplicação ou banco. Quando um requisito muda (“desativação passa a exigir X”), o lugar natural da alteração é a entidade — não dez arquivos espalhados.

---

## O que uma entidade não deve ter nem fazer (e por quê)

| Evitar na entidade                                   | Motivo                                                                                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chamar repositório, DAO, Prisma, HTTP, fila, arquivo | Persistência e integração são **efeitos colaterais**; misturar isso com regra torna o domínio impossível de testar em isolamento e acopla o modelo a tecnologia. |
| Depender de NestJS, Express, config de ambiente      | A entidade deve poder existir **fora** do framework; handlers e módulos é que ligam o mundo externo.                                                             |
| Orquestrar outros agregados ou “sagas”               | Coordenar vários passos, publicar no bus, chamar outro módulo é papel da **camada de aplicação**; a entidade governa **si mesma**.                               |
| Expor setters públicos para todo campo               | Permite estados inválidos; preferimos métodos que aplicam regra de uma vez.                                                                                      |

Em resumo: a entidade **modela e protege** o conceito; ela **não executa** o mundo exterior. Quando o domínio precisa “persistir” ou “avisar alguém”, quem faz isso é o handler usando repositório e event bus — depois que a entidade já validou e mudou de estado.

---

## Por que essa camada é essencial

Sem uma camada de domínio clara, a regra de negócio tende a vazar para controllers, serviços genéricos e queries SQL: o mesmo conceito é interpretado de formas diferentes em cada lugar, bugs de consistência aparecem e mudanças pequenas quebram fluxos inesperados. Ao **centralizar** o que é “usuário válido”, “membro ativo” ou “evento que representa esta transição”, criamos um **núcleo estável** que o restante do sistema apenas orquestra. O domínio não é burocracia: é o mapa explícito do negócio no código — e quanto mais esse mapa estiver concentrado em entidades e contratos bem nomeados, mais barato fica evoluir o produto com confiança.
