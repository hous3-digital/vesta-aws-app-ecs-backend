# Gateways (integrações externas)

**Gateway** é o nome que damos ao conjunto **porta (contrato) + implementações (providers/adapters)** usado para falar com serviços de terceiros — KYC, e-mail, armazenamento de arquivos, pagamentos, etc.

O objetivo é manter **consistência**, **isolamento** e **rastreabilidade**: o domínio e a aplicação dependem de **interfaces estáveis**; detalhes de cada API ficam em `src/infra/gateways/providers/`.

---

## O que isso resolve e por que vale a pena

| Benefício                                   | O que ganhamos                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domínio limpo**                           | Handlers e entidades não importam SDKs nem tipos da Veriff, AWS, etc. Eles falam só com `IKycPort`, `IEmailPort`, `IStoragePort` e tipos definidos na port. |
| **Troca de provedor sem reescrever regras** | Trocar Veriff por outro KYC (ou SES por SendGrid) é mudar o **adapter** e o **binding** na factory — não varrer o código de negócio.                        |
| **Testes**                                  | Nos testes, injeta-se um mock que implementa a mesma interface — sem HTTP real.                                                                             |
| **Uma única “linguagem” na aplicação**      | Inputs/outputs da port usam conceitos nossos; cada adapter traduz para o formato do provedor (mappers, `.type.ts` do provider).                             |
| **Rastreabilidade**                         | Chamadas HTTP passam pelo `EgressService` quando aplicável, alimentando logs de egress.                                                                     |

**Princípio central:** o **domínio define o contrato** (port). O **provider** implementa e traduz entre domínio e API externa. O domínio não deve espelhar nomes de campos, enums ou estruturas da documentação do terceiro — ver secção [Domínio e API externa](#domínio-e-api-externa).

---

## Visão geral: peças e responsabilidades

```
┌──────────────────────────────────────────────────────────────────┐
│  application / handlers                                          │
│  @Inject(StorageFactory) private readonly storage: IStoragePort  │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  PORT (contrato)                                                 │
│  kyc.port.ts — IKycPort + KycStartInput / KycStartOutput         │
└───────────────────────────────┬──────────────────────────────────┘
                                │ implementado por
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  ADAPTER (por provedor)                                          │
│  VeriffKycAdapter implements IKycPort — orquestra repositórios,  │
│  chama VeriffKycService, mapeia tipos                            │
└───────────────────────────────┬──────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  SERVICE + types do PROVEDOR                                     │
│  VeriffKycService — HTTP via EgressService, body no formato API  │
│  veriff-kyc.type.ts — *Input / *Output da API Veriff             │
└──────────────────────────────────────────────────────────────────┘
```

| Peça                                         | Onde fica                                           | Papel                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Port** (`I…Port` + tipos de entrada/saída) | `src/infra/gateways/ports/<feature>/`               | Contrato estável que a aplicação injeta.                                                                              |
| **Token da factory** (`Symbol`)              | `*.factory.ts` na mesma pasta da port               | Identificador de injeção — o handler injeta o token e tipa como `IStoragePort`.                                       |
| **Factory provider**                         | `*.factory.ts`                                      | Faz `provide: StorageFactory, useClass: AwsStorageAdapter` — **é aqui que se escolhe** qual adapter está ativo.       |
| **Port module** (`*PortModule`)              | `*.module.ts` na pasta da port                      | Importa os **módulos dos providers** necessários para instanciar o adapter escolhido e exporta o provider da factory. |
| **Adapter**                                  | `src/infra/gateways/providers/<empresa>/<feature>/` | Implementa `I…Port`, converte port ↔ tipos do provider, chama o `*Service`.                                           |
| **Service do provider**                      | Mesma pasta do adapter                              | Chamadas HTTP (Egress), headers, montagem de body; retornos via `ApiResult` / `handleHttpError`.                      |
| **Types do provider**                        | `*-kyc.type.ts`, etc.                               | Inputs/outputs **no vocabulário da API** — não exportar para domain.                                                  |
| **Mappers**                                  | `mappers/` sob o provider                           | Conversões puras domain ↔ provider (enums, status, formatos).                                                         |

---

## Fluxo: usar um gateway na aplicação

1. **Definir ou reutilizar a port** — interface `I…Port` e tipos em `kyc.port.ts` (ou `email.port.ts`, `storage.port.ts`).
2. **Exportar o token** — em `*.factory.ts`, `export const XxxFactory = Symbol("XxxFactory")`.
3. **Registrar o port module** no módulo de feature — ex.: `FileModule` importa `StoragePortModule`.
4. **Injetar no handler** — `@Inject(StorageFactory) private readonly storage: IStoragePort`.

Exemplo (padrão do projeto):

```typescript
import { Inject } from "@nestjs/common";
import { IStoragePort } from "@src/infra/gateways/ports/storage/storage.port";
import { StorageFactory } from "@src/infra/gateways/ports/storage/storage.factory";

// No construtor do handler:
@Inject(StorageFactory) private readonly storage: IStoragePort,
```

O handler só conhece `IStoragePort` — não importa AWS nem S3.

---

## Fluxo: criar um novo provider (novo adapter)

Ordem sugerida:

1. **Criar pasta do provider** em `src/infra/gateways/providers/<provedor>/<feature>/` (ex.: `veriff/kyc/`, `aws/ses/`).

2. **Tipos e service da API**
   - `*-<feature>.type.ts` — `ProviderActionInput` / `ProviderActionOutput`.
   - `*-<feature>.service.ts` — métodos que chamam a API; usar `EgressService` onde couber; JSDoc com links da documentação oficial; `handleHttpError` no `catch`.

3. **Módulo do provider** (`*-<feature>.module.ts`)
   - `EgressModule.registerAsync` com `baseURL` específica do provedor (um Egress por base URL).
   - `providers` / `exports` do service (e clientes AWS/SDK, se houver).

4. **Adapter** — classe `@Injectable()` que `implements I…Port`:
   - Injeta o `*Service` do provider (e repositórios/domain se precisar montar o input).
   - Converte `Input` da port → input do service (mappers quando necessário).
   - Converte resposta → tipos da port.

5. **Ligar na port**
   - No `*-port.module.ts`: `imports: [..., NovoProviderModule]` para que dependências do adapter estejam no grafo do Nest.
   - No `*.factory.ts`: `useClass: NovoAdapter` (ou manter um adapter e só trocar quando for mudar de provedor).

6. **Variáveis de ambiente** — adicionar chaves em `env.schema`, `EnvService` e `.env.example`.

7. **Módulo de negócio** — importar `XxxPortModule` onde for usar o gateway.

---

## Como alterar qual provider está em uso

Troca **centralizada** — não é feature flag por env neste template, é **binding explícito**:

1. Abra `src/infra/gateways/ports/<feature>/<feature>.factory.ts`.
2. Altere `useClass` para o adapter desejado, ex.:

```typescript
export const EmailFactoryProvider: Provider = {
  provide: EmailFactory,
  useClass: AwsSesAdapter, // troque para OutroEmailAdapter
};
```

3. No `<feature>.module.ts` da **port**, garanta que o **módulo do provider** correspondente está em `imports` (ex.: além de `AwsSesModule`, importe `SendGridModule` se o novo adapter depender dele).

4. Ajuste credenciais no `.env` para o novo provedor.

Quem consome o gateway **não muda** — continua injetando `EmailFactory` como `IEmailPort`.

---

## Estrutura de pastas (referência)

```
src/infra/gateways/
├── ports/
│   ├── kyc/
│   │   ├── kyc.port.ts          # IKycPort + tipos
│   │   ├── kyc.factory.ts       # token + useClass do adapter
│   │   └── kyc.module.ts        # KycPortModule — imports dos provider modules
│   ├── email/
│   └── storage/
└── providers/
    ├── veriff/
    │   └── kyc/
    │       ├── veriff-kyc.module.ts
    │       ├── veriff-kyc.service.ts
    │       ├── veriff-kyc.type.ts
    │       ├── veriff-kyc.adapter.ts   # implements IKycPort
    │       └── mappers/
    └── aws/
        ├── ses/
        └── storage/
```

**Quando criar novo diretório em `providers/`:** nova **empresa/produto** (ex.: `veriff`, `stripe`) ou, na mesma empresa, nova **área** (ex.: `aws/ses` vs `aws/storage`).

---

## Padrões que se mantêm (requests, retornos, mappers)

- **HTTP:** preferir `EgressService` para chamadas externas rastreáveis; credenciais só via `EnvService`.
- **Retornos do service do provider:** sucesso com `ApiResult<T>` ou `void`; erros via `handleHttpError`, não como `{ error }` no retorno.
- **Mappers:** funções puras; um arquivo por conversão relevante; valores não mapeáveis → exceção adequada (ex.: `UnprocessableEntityException`).
- **JSDoc:** métodos do service que batem na API devem documentar links oficiais — facilita manutenção.

Detalhes de nomeação (`[Provider][Action]Input`), FormData, datas e dinheiro seguem as mesmas ideias de antes: formatação e vocabulário da API **concentrados no provider**, não espalhados no domínio.

---

## Domínio e API externa

**Nunca** modele o domínio copiando a API externa (nomes de campos, enums crus, árvores de resposta). O domínio fala a linguagem do negócio; o adapter e os mappers traduzem. Tipos e nomes específicos do terceiro ficam em `gateways/providers/…`.

---

## Checklist rápido

- [ ] Port com `I…Port` e tipos estáveis em `ports/<feature>/`
- [ ] Token `Symbol` + `FactoryProvider` com `useClass` apontando para o adapter ativo
- [ ] `*PortModule` importando todos os módulos de provider necessários ao adapter
- [ ] Provider: `*Module` com Egress quando for HTTP, `*Service`, `*.type.ts`, adapter `implements I…Port`
- [ ] Mappers domain ↔ provider onde houver divergência de enums/formatos
- [ ] Env e documentação de variáveis para credenciais e URLs
