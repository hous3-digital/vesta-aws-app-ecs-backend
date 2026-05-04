# Logging HTTP (Ingress e Egress)

Duas trilhas complementares de **persistência de tráfego HTTP**:

- **Ingress** — requisições **recebidas** pela API (útil para webhooks e auditoria de entrada).
- **Egress** — requisições **enviadas** pela API para sistemas externos (via `EgressService` + Axios).

Ambas gravam em tabelas PostgreSQL (`ingress`, `egress`) via **Prisma**, com payload em **JSON**.

---

## Modelo de dados (Prisma)

| Modelo    | Tabela    | Campos principais                                               |
| --------- | --------- | --------------------------------------------------------------- |
| `Ingress` | `ingress` | `ingress_id`, `request` (Json), `response` (Json), `created_at` |
| `Egress`  | `egress`  | `egress_id`, `request` (Json), `response` (Json), `created_at`  |

IDs:

- **Ingress** — `Id.create("ingress").value` (value object de id do projeto).
- **Egress** — `typeid("egress").toString()`.

Os objetos são clonados com **`structuredClone`** antes de persistir, para evitar referências mutáveis inesperadas.

---

## Ingress

### Responsabilidade

Registrar **uma linha por evento** de entrada: o que chegou (IP, método, path, body, etc.) e um resumo da **resposta** (ex.: status).

### Módulo

- **`IngressModule`** — importa `DatabaseModule`, provê e exporta **`IngressLogger`**.

### Uso

1. Importar **`IngressModule`** no módulo da feature (ex.: hooks).
2. Injetar **`IngressLogger`**.
3. Após processar a requisição, chamar **`log(request, response)`** com objetos compatíveis com as interfaces do logger:

**Request (`IngressRequest`):** `ip`, `method`, `protocol`, `host`, `path`, `body` (opcional).

**Response (`IngressResponse`):** `status` (opcional).

Exemplo conceitual:

```typescript
await this.ingressLogger.log({ ip, method, protocol, host, path, body }, { status: statusCode });
```

### Quando usar

- Webhooks e endpoints onde o payload externo precisa ser **auditável** ou depurável depois do fato.
- Evitar logar dados sensíveis em claro (senhas, tokens); filtrar no controller/handler antes de chamar `log`, se necessário.

---

## Egress

### Responsabilidade

Registrar chamadas **HTTP de saída** feitas pela aplicação, para rastreio e suporte (status, corpo da resposta, metadados do request).

### Módulo dinâmico

**`EgressModule.registerAsync(options)`** — espelha **`HttpModule.registerAsync`** do Nest (`@nestjs/axios`): você passa `inject`, `useFactory` com `baseURL`, timeouts, headers, etc.

- Importa **`DatabaseModule`**, registra **`EgressLogger`** e **`EgressService`**, exporta apenas **`EgressService`** (o logger é interno).

### `EgressService`

- Encapsula **`HttpService` (Axios)**.
- **Interceptors:**
  - **Response sucesso** — monta `EgressRequest` / `EgressResponse` e chama `egressLogger.log`.
  - **Response erro com `error.response`** — também loga request/response antes de relançar o erro.
  - Falhas **sem** `error.response` (rede, timeout) — não passam pelo ramo de log atual; o erro propaga sem linha de egress.

Métodos expostos: **`get`**, **`post`**, **`delete`**, **`put`**, **`patch`** — delegam ao Axios e retornam dados conforme implementação (ex.: `get`/`post` retornam `response.data`).

### Quando usar

- **Sempre** que integrar HTTP com APIs externas no padrão do projeto — preferir **`EgressService`** em vez de Axios solto, para alimentar a tabela `egress` automaticamente.
- Um **`EgressModule.registerAsync` por `baseURL`** (ex.: módulo Veriff, módulo SES), como já feito nos gateways.

### Tipos (`EgressLogger`)

- **`EgressRequest`:** `method`, `protocol`, `host`, `path` (derivados do objeto de request do Axios no sucesso/erro HTTP).
- **`EgressResponse`:** `status`, `data` opcional.

---

## Relação com Gateways

Os **providers** em `src/infra/gateways/providers/` devem usar **`EgressService`** para chamadas HTTP rastreáveis, alinhado a [gateways.md](gateways.md). Assim, KYC, e-mail e storage deixam rastro consistente em **`egress`**.

---

## Cuidados

| Tema               | Recomendação                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Volume**         | Tabelas podem crescer rápido; planejar retenção, arquivamento ou TTL em produção.                                                                                 |
| **PII / segredos** | Não logar tokens ou documentos em claro; sanitizar `body`/`data` antes se necessário.                                                                             |
| **Performance**    | `log` é `async` e aguardado nos interceptors — falha no insert pode afetar o fluxo; avaliar try/catch interno em evoluções futuras se precisar “fire and forget”. |
| **Consistência**   | Ingress manual no handler; egress automático no client — manter essa divisão mental (entrada explícita, saída via `EgressService`).                               |

---

## Checklist

- [ ] Webhook ou entrada sensível: **`IngressModule`** + **`IngressLogger.log`**
- [ ] HTTP para terceiros: **`EgressModule.registerAsync`** + **`EgressService`**
- [ ] Conferir migrations se novos campos forem adicionados aos modelos `Ingress`/`Egress`
