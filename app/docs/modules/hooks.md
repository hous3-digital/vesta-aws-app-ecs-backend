# Hooks (Webhooks)

Guia para receber webhooks e callbacks de serviços externos (pagamento, KYC, notificações, etc.).

## O que são e quando usar

**Hooks** recebem requisições HTTP de terceiros — webhooks de pagamento (Stripe), callbacks de KYC (Veriff), notificações assíncronas, etc.

Use o módulo Hook quando precisar de um **endpoint que aceita POSTs de sistemas externos** e precisa processar ou encaminhar esses dados.

---

## Padrão de rota

**Sempre use o padrão:** `/hooks/[provider]`

- `[provider]` = nome do provedor em minúsculo (veriff, stripe, sendgrid, etc.)
- Uma rota por provedor; múltiplos eventos do mesmo provedor podem compartilhar a rota ou ter sub-rotas conforme a API do provedor

**Exemplos:**

- `POST /hooks/veriff` — callbacks Veriff
- `POST /hooks/stripe` — webhooks Stripe
- `POST /hooks/sendgrid` — eventos SendGrid

---

## Responder o quanto antes

**Princípio:** Responda **200/OK o mais rápido possível** para evitar retries e respostas falhas do provedor.

Muitos provedores têm timeout curto (ex.: 5–30s). Se demorar, eles fazem retry, e o mesmo evento pode ser processado duas vezes.

**Como fazer:**

1. Receba o request
2. Valide formato mínimo (se necessário)
3. Loge no Ingress
4. Responda **200** imediatamente
5. Publique evento e processe de forma **assíncrona** via handlers

O controller/handler do hook **não deve** fazer processamento pesado (DB pesado, chamadas externas, etc.). O processamento real fica nos handlers que reagem ao evento publicado.

---

## Padrão por webhook: endpoint, command e handler

**Cada webhook exige sua própria tríade:**

| Componente   | Nomenclatura                                                  | Responsabilidade                                        |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------- |
| **Endpoint** | `POST /hooks/[provider]` ou `POST /hooks/[provider]/[evento]` | Recebe request, monta Command, delega ao CommandBus     |
| **Command**  | `HookInternalProcess[Provider]Command`                        | DTO com dados do request (method, path, body, ip, etc.) |
| **Handler**  | `HookInternalProcess[Provider]Handler`                        | Loga no Ingress, valida idempotência, publica evento    |

**Estrutura de arquivos:**

```
modules/hook/
├── api/internal/
│   └── hook-internal.controller.ts    # Todas as rotas /hooks/*
├── application/internal/
│   ├── commands/
│   │   ├── hook-internal-process-veriff.command.ts
│   │   └── hook-internal-process-stripe.command.ts
│   └── handlers/
│       ├── hook-internal-process-veriff.handler.ts
│       └── hook-internal-process-stripe.handler.ts
```

O controller expõe uma rota por provedor; cada rota instancia seu Command e chama o CommandBus. Cada Handler é responsável por um provedor.

---

## Fluxo completo

```
Request externo
    → Controller (POST /hooks/veriff)
    → Command (HookInternalProcessVeriffCommand)
    → Handler:
        1. Verificar idempotência (event_id já processado?)
        2. IngressLogger.log(request, response)
        3. Responder 200 (o mais cedo possível na cadeia)
        4. EventBus.publish(ExternalVeriffKycReceivedEvent)
    → Saga/handler em outro módulo processa o evento de forma assíncrona
```

---

## IngressLogger

**Sempre** logue a entrada no Ingress. Isso permite:

- Auditoria de todos os webhooks recebidos
- Debug em caso de disputas ou problemas
- Rastreabilidade de payloads e respostas

O IngressLogger persiste na tabela `ingress` (request + response). Use antes de publicar o evento.

---

## Boas práticas

1. **Validar e sanitizar** o payload antes de gravar (evitar injecções, tamanhos absurdos)
2. **Logar no Ingress** em todo handler de hook
3. **Responder rápido** — processamento pesado em handlers assíncronos via eventos
4. **Tratar erro** sem expor detalhes internos; logar e propagar quando apropriado
5. **Sem Swagger** — Controllers de hook usam `@ApiExcludeController()`; rotas internas, não documentadas publicamente

---

## Quando criar um novo Hook

- Webhooks de pagamento (Stripe, PagSeguro, etc.)
- Callbacks de KYC (Veriff, etc.)
- Qualquer API externa que envia POST para notificar eventos

Cada provedor = uma nova rota + command + handler no módulo Hook.
