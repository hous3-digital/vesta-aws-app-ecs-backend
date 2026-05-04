# Camada de apresentação (Api)

Este documento descreve como organizamos a camada HTTP: rotas, classes, DTOs, serialização e relação com comandos e queries.

## Envelope padrão: `{ data }`

Toda resposta de sucesso é envolvida no formato `{ data: ... }`.

- O **`ApiTransformInterceptor`** intercepta o retorno do handler e transforma o payload em `{ data: resultado }`. Se o handler retornar `undefined`, o cliente recebe `{ data: null }`.
- No **Swagger**, os decorators **`ApiOkResponseData`** e **`ApiCreatedResponseData`** documentam esse contrato usando o tipo genérico **`ApiDataResponse<T>`**, de modo que o schema declare explicitamente a propriedade `data` e o modelo do corpo (objeto ou array).

O controller declara o tipo “interno” do payload (por exemplo `UserOutput` ou `UserOutput[]`); o interceptor adiciona o envelope `data` na resposta HTTP.

## Nomes de rotas

- O **`@Controller`** usa um prefixo por contexto e módulo, em **kebab-case** e com barra inicial opcional mas consistente no projeto, por exemplo:
  - **`/public/{recurso}`** — endpoints públicos ou autenticados com escopo “app”.
  - **`/backoffice/{recurso}`** — endpoints administrativos.
- Segmentos adicionais descrevem a ação ou o recurso, por exemplo `PATCH /deactivate/:id`, `POST /authenticate`.
- **`@ApiTags`** agrupa no Swagger pelo domínio (ex.: `"user"`, `"auth"`, `"membership"`).

Mantenha URLs previsíveis: pluralização e nomes alinhados ao módulo e ao que o cliente espera.

## Nomes de classes de controller

Padrão: **`{Entidade}{Contexto}Controller`**, em PascalCase.

- Contexto reflete o “superfície” da API: **`Public`**, **`Backoffice`**, **`Internal`**, etc.
- Exemplos: `UserPublicController`, `UserBackofficeController`, `AuthPublicController`, `MembershipPublicController`.

Isso evita colisão entre superfícies e deixa claro em qual documentação OpenAPI e qual guard/política o endpoint se encaixa.

## Nomes de métodos do controller

Use **verbos ou intenção de negócio** em **camelCase**, alinhados à operação HTTP:

- Comandos de criação: `create`, `authenticate`, `authorize`.
- Alteração de estado: `deactivate`, etc.
- Leitura: nomes que descrevem o caso de uso (`memberships`, `findMany`, conforme o time padronizar no módulo).

O método deve soar como **caso de uso**, não como nome de repositório (`getById` no controller só se for o padrão explícito do módulo).

## `toOutput` — o que é e para que serve

**`toOutput`** (`src/utils/helpers/to-output.helper.ts`) usa **`plainToInstance`** do `class-transformer` para instanciar a classe de **output** a partir de um objeto simples (geralmente JSON vindo do mapper após o domínio).

- **Comandos** que retornam **entidades de domínio** costumam passar por **`Mapper.toJSON(entidade)`** e então **`toOutput(MinhaOutput, json)`** para garantir o contrato da API (campos expostos, tipos, defaults).
- Centraliza a conversão “objeto plano → classe de DTO de saída” com opções consistentes (`enableImplicitConversion`, `exposeDefaultValues`, etc.).

Assim o controller não monta o objeto de resposta à mão campo a campo; a classe `*Output` define o formato e a política de exposição.

## Classes `*Output` — `@Expose`, `@Exclude` e Swagger

As classes em `api/common/*.output.ts` são o **contrato público da API**.

- **`@Expose()`** marca propriedades que entram na serialização quando usamos `class-transformer` / **`ClassSerializerInterceptor`** global. Sem expor, o campo pode ser omitido dependendo da configuração.
- **`@Exclude()`** remove campos sensíveis ou internos do payload (ex.: senha), mesmo que existam no objeto de origem.
- **`@ApiProperty`** (e variantes) alimenta o **Swagger** com exemplos, formatos e enums — obrigatório para documentação útil.

Ou seja: **`Expose`/`Exclude`** controlam o **JSON enviado ao cliente**; **`ApiProperty`** controla a **documentação** e não substitui a regra de serialização.

## Papel do controller: fino, sem infraestrutura direta

O controller deve:

1. **Receber** entrada já validada: **`@Body()`** em classes `*Input`, **`@Param()`** em classes `*PathParam` / `*Param`, query em `*Query` quando existir.
2. **Traduzir** para o domínio onde necessário (ex.: **`Id.restore(param.id)`**, value objects, enums).
3. **Delegar** a **`CommandBus`** (comandos) ou **`QueryBus`** (queries) — **não** injetar repositórios, DAOs ou clients HTTP no controller.

Objetivo: manter **HTTP + DTO** separados de **regras de negócio e persistência**. Testes e evolução do domínio não dependem do Nest nem do contrato REST.

### Comandos e `toOutput`

Fluxo típico após um comando:

- Executar o comando → receber **entidade** ou resultado de domínio.
- Se vier entidade: **`Mapper.toJSON(...)`** (ou equivalente) e então **`toOutput(XxxOutput, json)`**.

Isso mantém uma única camada de “formato API” e respeita exclusões (`@Exclude`).

### Queries e por que **não** usar `toOutput` (padrão desejado)

Para **queries**, o dado costuma vir **já projetado** do banco (SELECT com colunas explícitas, joins, agregações). O handler de query ou o DAO monta um objeto alinhado ao DTO de listagem/detalhe.

- **Não** passar esse resultado por `toOutput` evita **dois lugares** para definir o mesmo shape (query SQL + classe output + `plainToInstance`), o que piora muito com **joins complexos** e renomeações de colunas.
- O contrato da API para leitura fica na **própria projeção da query** (e na classe `*Output` usada só para tipagem e Swagger, sem transformação pesada).

Se no futuro um endpoint de query precisar de ajuste fino de formato, prefira ajustar a projeção/query ou um mapper dedicado à **camada de aplicação da query**, não empilhar `toOutput` em cima de estruturas já montadas para o cliente.

## Decorators de validação customizados

Para regras que não existem no `class-validator` padrão (datas, dinheiro, regras de domínio leve), usamos decorators registrados com **`registerDecorator`**, seguindo o mesmo estilo do projeto de referência e do exemplo em `src/utils/decorators/is-past-date.decorator.ts`:

- Nome do decorator em **PascalCase** exportado (ex.: `IsPastDate`).
- **`name`** estável no `registerDecorator` (para mensagens e depuração).
- **`options.message`** padrão + merge com **`ValidationOptions`** recebidos.
- **`validator.validate`** com a lógica pura; sem dependências de request no decorator.

Outros exemplos no repositório: `is-future-date.decorator.ts`, `is-valid-money.decorator.ts`. Reutilize ou estenda esses padrões em vez de espalhar validação manual nos controllers.

## Body, path params e query params separados

Cada origem de dados tem **sua própria classe** e **sua validação**:

| Origem       | Uso típico           | Classe exemplo                      |
| ------------ | -------------------- | ----------------------------------- |
| Corpo        | `POST`/`PATCH`/`PUT` | `UserPublicCreateInput`             |
| Rota         | `@Param()`           | `UserBackofficeDeactivatePathParam` |
| Query string | `GET` com filtros    | `*Query` (quando existir)           |

Motivos:

- O **`ValidationPipe`** com `transform: true` valida e transforma cada classe isoladamente.
- Evita misturar campos opcionais de query com campos obrigatórios do body e regras diferentes para o mesmo nome.
- Documentação Swagger fica correta (`@ApiProperty` em cada classe no lugar certo).

Não reutilize um único DTO “gigante” para body + query + path; isso quebra clareza e validação por contexto.
