# Estratégia de Testes

Como decidir entre unit, integration e E2E, e padrões de implementação.

## Separação por tipo

| Tipo            | O que testa                                            | Quando usar                                                                               |
| --------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Unit**        | Entidades, Value Objects                               | Regras de domínio, invariantes, cálculos, validações, transições de estado                |
| **Integration** | Handlers, Services (com mocks)                         | Regras de negócio nos handlers/services: condicionais, transformações, tratamento de erro |
| **E2E**         | API completa (HTTP → Controller → Handler → Repo → DB) | Caminho completo; cobre use cases **thin** sem teste de integração dedicado               |

## Critério de decisão: o teste descreve uma regra de negócio?

> **Sim** → Unit ou Integration (conforme o tipo de regra)  
> **Não** → E2E cobre

### Exemplos

| Descrição do teste                                | Tipo                            |
| ------------------------------------------------- | ------------------------------- |
| "deveria rejeitar endereço sem CEP"               | Integration (tem regra)         |
| "deveria normalizar o estado para uppercase"      | Integration (tem transformação) |
| "deveria chamar save e retornar o resultado"      | **E2E cobre** — só wiring       |
| "deveria transicionar status para Paid quando..." | Unit (entidade)                 |

### Use case thin

Use cases que só orquestram de forma simples sem envolver regras (recebem input → chamam repository/service → retornam) **não precisam** de teste de integração dedicado. O E2E já cobre esse caminho.

Escrever integração que mocka o repositório para verificar que foi chamado com os argumentos corretos é basicamente testar que o código foi escrito como foi escrito — não que ele funciona.

### Evitar

- Mocks de repositório para checar chamadas com argumentos específicos
- Testes cuja melhor descrição é repetir a implementação
- Coverage como objetivo cego — use como indicador; use case thin coberto por E2E está coberto

## Na prática

- **Use case tem if, switch, validação, transformação, tratamento de erro?** → Integration
- **Use case é passthrough pro repository?** → E2E cobre
- **Na dúvida?** Escreva o teste. Se sentir que está só repetindo a implementação, delete e siga em frente

---

## Princípios: FIRST

Testes devem ser Fast, Independent, Repeatable, Self-Validating, Timely.

| Característica      | O que significa                                                           |
| ------------------- | ------------------------------------------------------------------------- |
| **Fast**            | Execução em milissegundos, sem bancos/APIs/arquivos, paralelizável        |
| **Independent**     | Sem ordem de execução, sem estado compartilhado, dados isolados por teste |
| **Repeatable**      | Resultado determinístico, sem dependência de rede, tempo ou ambiente      |
| **Self-Validating** | Passa ou falha, sem interpretação manual; assertions explícitas           |
| **Timely**          | Escrito junto ou antes do código; mantido ao refatorar                    |

E2E pode ter dependências externas; o objetivo é minimizá-las.

---

## Padrão AAA (Arrange-Act-Assert)

Use em todo teste (unit ou integration).

| Fase        | O que fazer                                                             |
| ----------- | ----------------------------------------------------------------------- |
| **Arrange** | Configurar dados e dependências; preparar mocks; definir estado inicial |
| **Act**     | Executar **uma única ação** — o método sob teste                        |
| **Assert**  | Verificar resultado específico; uma responsabilidade por teste          |

Em testes de exceção, Act e Assert podem ser combinados (`// Act & Assert`).

```typescript
it("should [comportamento esperado] when [condição]", () => {
  // Arrange
  const input = "dados";
  const expected = "resultado";

  // Act
  const result = metodoSobTeste(input);

  // Assert
  expect(result).toBe(expected);
});
```

---

## Estrutura de pastas

```
__tests__/
├── @e2e/                   # Testes end-to-end
│   └── fixtures/           # Fixtures E2E (ex: user-api.fixture)
├── @integration/           # Testes de integração (Service, Handler)
│   ├── services/
│   └── handlers/
├── @unit/                  # Testes unitários
│   ├── entities/           # Testes de entidades
│   └── value-objects/      # Testes de value objects
├── mocks/                  # Mocks e factories compartilhados
│   ├── repository/         # mock*Repository()
│   ├── model/              # *Model() factories
│   ├── service/            # mock*Service()
│   └── cqrs/               # mockEventBus, etc.
├── helpers/                # Helpers de teste
└── constants/              # Constantes de teste
```

---

## Nomenclatura

- **Arquivos:** `*.spec.ts` para unit e integration
- **describe:** Nome da classe ou funcionalidade
- **it:** Comportamento específico sendo testado

```typescript
// ✅ Bom
describe("Investment", () => {
  describe("pay", () => {
    it("should transition status to Paid when investment is in Created status", () => {});
  });
});

// ❌ Ruim
describe("Investment", () => {
  it("works", () => {});
});
```

---

## Testes de entidades de domínio

Entidades protegem invariantes de negócio. Teste **regras de domínio**, não getters, setters triviais, `restore()`, `touch()`, `toEvent()` ou inicialização de campos.

### O que testar

| Tipo de cenário        | Exemplo                                              |
| ---------------------- | ---------------------------------------------------- |
| Happy path             | `pay()` transiciona status para Paid e define paidAt |
| Guard / exceção        | `pay()` lança quando status não é Created            |
| Cálculo de negócio     | `quantityQuote` é computado corretamente             |
| Side effect de domínio | `deactivate()` define deactivatedAt                  |

Cada teste deve ser justificável por uma regra de negócio. Se não conseguir nomear a regra, não teste.

### Padrão para testes de exceção

Use `const fn` para evitar duplicar a chamada e validar tipo e mensagem:

```typescript
it("should throw when investment is not in Created status", () => {
  // Arrange
  const investment = Investment.create(...);
  investment.pay();

  // Act & Assert
  const fn = () => investment.pay();
  expect(fn).toThrow(UnprocessableEntityException);
  expect(fn).toThrow(`Cannot pay investment in ${InvestmentStatus.Paid} status`);
});
```

### Regras para testes de entidade

**MUST DO:**

- Declarar inputs como variáveis nomeadas no Arrange — nunca literais inline
- Usar `// Arrange`, `// Act`, `// Assert` em todo teste
- Validar **tipo** e **mensagem** em todo teste de exceção
- Usar valores de enum nas mensagens esperadas — nunca strings hardcoded

**MUST NOT DO:**

- Usar factory helpers (`makeSut`, `makeInvestment`, `make*`)
- Testar getters, setters triviais, `restore()`, `touch()`, `toEvent()`
- Testar inicialização de campos ou valores default
- Testar lógica de infraestrutura (mappers, serialização)
- Um teste cobrindo múltiplos comportamentos
- Assertions com só `toBeTruthy()` ou `toBeDefined()`

---

## Testes de integração

Validam orquestração entre componentes com mocks. **Não** usados para invariantes de entidade (unit) nem quando precisa de banco real (E2E).

### Padrão makeSut

Obrigatório em testes de integração. Factory para instanciar o componente e os spies:

```typescript
const makeSut = () => {
  const contactRepoSpy = mockContactRepository();
  const sut = new ContactService(contactRepoSpy);
  return { sut, contactRepoSpy };
};
```

### Infra compartilhada

| Categoria       | Padrão                   | Localização                   |
| --------------- | ------------------------ | ----------------------------- |
| Repository Mock | `mock[Entity]Repository` | `__tests__/mocks/repository/` |
| Model Factory   | `[entity]Model`          | `__tests__/mocks/model/`      |

### Regras para testes de integração

**MUST DO:**

- Usar padrão `makeSut` em todo arquivo
- Colocar em `__tests__/@integration/[module]/`
- Usar `// Arrange`, `// Act`, `// Assert`
- Usar `faker` para dados dinâmicos (email, nome, etc.)
- Usar `mock*Repository()` e `*Model()` centralizados

**MUST NOT DO:**

- Instanciar o componente dentro de `it` ou `describe`
- Usar banco real (Prisma/Postgres)
- Testar regras de domínio já cobertas por unit
- Hardcodar valores que deveriam ser dinâmicos
- Assertar que métodos de **leitura** foram chamados com argumentos específicos — foca em **resultados** (estado, persistência, eventos, erros)

### O que NÃO assertar em integration

Nunca assertar chamadas de métodos de **leitura** (ex.: `findByIdOrThrow`). Isso acopla ao implementation; refatorar como dados são buscados quebraria testes. Foque em outcomes.

```typescript
// ❌ Ruim
expect(spies.investmentRepoSpy.findByIdOrThrow).toHaveBeenCalledWith(investmentId);

// ✅ Bom
expect(offer.status).toBe(OfferStatus.Achieved);
expect(spies.offerRepoSpy.updateOrThrow).toHaveBeenCalledWith(offer);
expect(spies.eventBusSpy.publish).toHaveBeenCalled();
```

---

## Anti-patterns

**Evitar:**

- Testes muito grandes cobrindo múltiplas funcionalidades
- Dependências externas (banco, APIs, arquivos)
- Dados não-determinísticos (timestamps, IDs aleatórios)
- Assertions vagas (`expect(result).toBeTruthy()`)
- Setup complexo
- Testes acoplados entre si

**Fazer:**

- Um foco por teste
- Dados controlados e previsíveis
- Assertions claras e específicas
- Setup mínimo
- Testes isolados
- Nomes que expliquem o comportamento

---

## Indicadores de qualidade

- **Tempo de execução:** < 1 segundo para a suíte de unit/integration
- **Manutenibilidade:** Fácil de entender e modificar
- **Confiabilidade:** Testes não falham aleatoriamente
- **Documentação:** Testes servem como documentação viva
