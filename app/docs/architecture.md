# Arquitetura e Princípios

Princípios e decisões arquiteturais do template. Consulte este documento antes de implementar novas funcionalidades.

## DDD pragmático

Adotamos conceitos de Domain-Driven Design de forma **pragmática**, não dogmática.

**O que usamos:**

- **Aggregates e entidades** — Modelam regras de negócio e invariantes
- **Value Objects** — Encapsulam validação e transformação no domínio
- **Repositories** — Abstração de persistência para o domínio
- **Eventos de domínio** — Quando faz sentido desacoplar módulos

**O que evitamos:**

- Bounded contexts rígidos e complexidade desnecessária
- Anemia de domínio — entidades que são só bags de dados
- Camadas em excesso que não agregam valor

---

## CQRS

Separação clara entre **leitura** (Query) e **escrita** (Command).

| Modelo      | Camada | Acesso a dados                               |
| ----------- | ------ | -------------------------------------------- |
| **Command** | Write  | Repository (entidades de domínio)            |
| **Query**   | Read   | DAO (Data Access Object) — projeções diretas |

- **Commands:** Orquestram fluxos, validam, persistem via Repository. Handlers executam comandos.
- **Queries:** Preenchem telas, listas, relatórios. Usam DAO para leituras sem passar por entidades ricas.

Não é CQRS com stores separados — é separação de responsabilidade no acesso a dados.

---

## Repository vs DAO

| Ferramenta                   | Quando usar               | Exemplo                                                                  |
| ---------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| **Repository**               | Domínio (Commands)        | `userRepository.saveOrThrow(user)`, `userRepository.findByIdOrThrow(id)` |
| **DAP** (Data Access Object) | Queries, telas, projeções | Buscar dados para listagens, relatórios, telas sem lógica de domínio     |

- **Repository:** Entidades, invariantes, regras. Usado em handlers de command.
- **DAP:** Objetos de leitura, DTOs, queries diretas. Nunca retorna entidades de domínio.

---

## Agregado raiz e programação defensiva

**Princípio:** Ao trabalhar com dados relacionados, sempre siga o **agregado raiz**. Não confie em IDs armazenados em entidades dependentes.

### Problema

```typescript
const permission = await permissionRepo.findByAccountId(accountId);
const contact = await contactRepo.findByUserId(permission.userId); // permission.userId pode estar inconsistente
```

Se `permission.userId` estiver incorreto no banco, o fluxo propaga dados errados.

### Solução

```typescript
const permission = await permissionRepo.findByAccountId(accountId);
const user = await userRepo.findById(permission.userId); // Garante que o user existe e é válido
const contact = await contactRepo.findByUserId(user.id);
```

- Garante consistência do domínio
- Permite validar status, roles ou outros atributos antes de usar dados relacionados
- Evita propagação de inconsistências

### Regra prática

**Evite JOINs em repositórios.** Prefira requisições separadas seguindo o agregado raiz.

---

## Código flat

Mantenha o código **plano**, evitando `if` e `for` aninhados.

- Use **early return** e **guard clauses**
- Extraia funções quando a complexidade crescer
- Evite pirâmide de indentação

```typescript
// ✅ Flat
if (!user) throw new NotFoundException("User not found");
if (!user.isActive) throw new ForbiddenException("User inactive");

return processUser(user);

// ❌ Aninhado
if (user) {
  if (user.isActive) {
    return processUser(user);
  } else {
    throw new ForbiddenException("User inactive");
  }
} else {
  throw new NotFoundException("User not found");
}
```

---

## Value Objects e validação na borda

**Value Objects** encapsulam regras de domínio (validação, normalização, invariantes).

**Decorators na API** (ex.: class-validator) garantem a **mesma regra na borda** — entrada inválida nem chega ao domínio.

- **Domínio:** Value Objects (`Name.create()`, `Password.create()`) — regra definitiva
- **API:** Decorators (`@IsEmail()`, `@MinLength()`) — primeira linha de defesa

Dupla validação com regras alinhadas: borda rejeita cedo, domínio garante consistência.

---

## TypeID

**Sempre use [typeid-js](https://github.com/segmentio/typeid-js)** para identificadores.

**Vantagens:**

- **Prefixo por tipo** — `user_01h2x...`, `order_01h2y...` — rastreabilidade em logs, bugs, suporte
- **Sortable** — Baseado em UUIDv7, ordenável por tempo de criação
- **Evita mistura de IDs** — Difícil usar `orderId` onde se espera `userId`
- **Debugging** — Logs e erros ficam mais claros

---

## Single Responsibility

Mantenha **uma responsabilidade por componente**.

Sinais de violação:

- A classe/função faz mais de uma coisa
- O nome precisa de "e" para descrever (ex.: "CreateAndNotifyUser")
- Mudanças em um requisito afetam o outro

Quando perceber que algo faz mais de uma coisa: extraia, divida, renomeie.

---

## Eventos

**Use eventos com cautela.**

- **Quando usar:** Acoplamento temporal entre módulos (ex.: webhook recebido → atualizar usuário em outro módulo)
- **Quando evitar:** Fluxo linear que pode ser chamada direta — eventos adicionam complexidade de rastreamento e debugging

Cada evento aumenta:

- Complexidade de entendimento
- Dificuldade de debug (fluxo assíncrono)
- Custo de manutenção

Preferir chamadas diretas quando o fluxo é síncrono e está no mesmo contexto.
