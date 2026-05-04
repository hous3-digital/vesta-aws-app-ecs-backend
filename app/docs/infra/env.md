# Env (variáveis de ambiente)

Configuração carregada com **`@nestjs/config`**, validada com **Zod** em **`env.schema.ts`** e exposta de forma tipada pelo **`EnvService`**.

---

## Fluxo

1. **`EnvModule`** (`@Global()`) importa `ConfigModule.forRoot(validate)`.
2. **`validate`** em `env.schema.ts` — objeto `{ validate: envConfig }` **somente** quando `NODE_ENV === "local"`; caso contrário é `undefined` e o Nest não aplica o parser Zod na subida (comportamento do template para ambientes não locais).
3. **`envConfig`** faz `envSchema.parse(config)` — qualquer chave faltando ou inválida **falha na inicialização** quando a validação está ativa.
4. **`EnvService`** encapsula `ConfigService.get(...)` em getters com tipos explícitos.

Para variáveis **novas**, o caminho completo é: `.env` / `.env.example` → **`env.schema.ts`** → **`EnvService`** (getters) → uso nos módulos.

---

## Schema atual (`env.schema.ts`)

| Variável                    | Tipo / regra                                       | Uso típico                                             |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| `NODE_ENV`                  | `local` \| `test` \| `development` \| `production` | Ambiente lógico da aplicação                           |
| `PORT`                      | string → número                                    | Porta HTTP do Nest                                     |
| `DATABASE_URL`              | URL                                                | PostgreSQL (Prisma)                                    |
| `JWT_ACCESS_SECRET`         | string não vazia                                   | Segredo de assinatura JWT (ver [cipher.md](cipher.md)) |
| `VERIFF_BASE_URL`           | URL                                                | API Veriff (KYC)                                       |
| `VERIFF_API_KEY`            | string                                             | Credencial Veriff                                      |
| `VERIFF_SECRET_KEY`         | string                                             | Credencial Veriff                                      |
| `AWS_S3_PUBLIC_BUCKET`      | string                                             | Bucket S3 público                                      |
| `AWS_S3_PRIVATE_BUCKET`     | string                                             | Bucket S3 privado                                      |
| `AWS_S3_PUBLIC_BASE_URL`    | URL                                                | Base URL pública dos objetos (ex.: CDN ou endpoint S3) |
| `AWS_REGION`                | string                                             | Região AWS                                             |
| `AWS_IAM_ACCESS_KEY_ID`     | string                                             | Chave IAM                                              |
| `AWS_IAM_SECRET_ACCESS_KEY` | string                                             | Secret IAM                                             |

**Nota:** `AWS_S3_PUBLIC_BASE_URL` está no schema de validação; confira se o **`EnvService`** expõe getter correspondente ao integrar novos consumidores — o padrão do projeto é acessar via getters para manter tipagem e um único lugar de leitura.

---

## `EnvService` — getters úteis

Além das variáveis acima, há helpers:

- **`IS_PRODUCTION`** — `NODE_ENV === "production"`
- **`IS_TEST`** — `NODE_ENV === "test"`
- **`NODE_ENV`** — união literal dos quatro valores permitidos

Use esses flags em vez de comparar strings espalhadas pelo código.

---

## Validação só em `local`

```typescript
const isLocal = process.env.NODE_ENV === "local";
export const validate = isLocal ? { validate: envConfig } : undefined;
```

- Em **`local`**, o Zod valida o objeto de config — erros explícitos ao subir o app.
- Fora de `local`, **`validate` é `undefined`** — o `ConfigModule` não passa pelo `envConfig`; assume-se que deploy (Docker, K8s, etc.) injeta variáveis corretas. Se quiser validação estrita em CI/prod, seria preciso estender essa política (ex.: `development` também validar).

---

## Boas práticas

- Manter **`.env.example`** alinhado ao schema (sem segredos reais).
- **Nunca** commitar `.env` com credenciais.
- Novas integrações: adicionar ao Zod **antes** de usar em factories/gateways para falhar cedo.
- Preferir **`EnvService`** a `process.env` direto nos serviços Nest (testabilidade e consistência).

---

## Testes e E2E

Scripts de teste costumam usar **`.env.test`** (via `dotenv -e .env.test` no `package.json`). Garanta que as mesmas chaves existam lá, com valores adequados ao banco/URLs de teste.
