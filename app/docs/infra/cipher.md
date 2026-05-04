# Cipher (JWT e tokens)

A pasta **`src/infra/cipher/`** concentra mecanismos de **criptografia e assinatura** usados pela API. Hoje o escopo é **JWT** (access token) via `@nestjs/jwt`, com segredo vindo do ambiente.

---

## O que existe no template

| Artefato       | Caminho                              | Papel                                                                                                       |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **JwtModule**  | `src/infra/cipher/jwt/jwt.module.ts` | Registra o `JwtModule` do Nest com `registerAsync`, injetando `JWT_ACCESS_SECRET` a partir do `EnvService`. |
| **JwtPayload** | `src/infra/cipher/jwt/jwt.type.ts`   | Tipo do payload decodificado no acesso — `sub`, `membershipId`, `iat`, `exp`.                               |

O módulo é **`@Global()`** e **re-exporta** o `JwtModule` base do Nest, para que `JwtService` fique disponível onde o módulo for importado.

---

## Configuração em runtime

- O segredo vem de **`JWT_ACCESS_SECRET`** (validado em `env.schema.ts` e exposto em `EnvService`).
- Não há segundo segredo de refresh neste template: o fluxo de autenticação usa **`JwtService.sign`** com `expiresIn` configurável no handler/serviço de auth.

Trecho relevante:

```typescript
BaseJwtModule.registerAsync({
  inject: [EnvService],
  useFactory: async (envService: EnvService) => ({
    secret: envService.JWT_ACCESS_SECRET,
  }),
}),
```

---

## Uso na aplicação

1. **Importar** `JwtModule` de `@src/infra/cipher/jwt/jwt.module` no módulo que precisa emitir ou validar tokens (ex.: `AuthModule`).
2. **Injetar** `JwtService` do `@nestjs/jwt` nos serviços e guards.
3. Ao **decodificar** o token nos guards, usar o tipo **`JwtPayload`** para alinhar com o que foi assinado (campos como `sub` e `membershipId`).

Exemplos no projeto:

- **`AuthService`** — `jwtService.sign(payload, { expiresIn })` para criar access tokens.
- **`AuthBaseGuard` / guards de auth** — `jwtService.decode<JwtPayload>(accessToken)` para obter o payload sem repetir estrutura mágica.

---

## Contrato do payload (`JwtPayload`)

```typescript
export type JwtPayload = {
  exp: number;
  iat: number;
  sub: string;
  membershipId: string;
};
```

- **`sub`** — identificador do sujeito (ex.: usuário).
- **`membershipId`** — vínculo membership usado na autorização.
- **`iat` / `exp`** — emitidos pelo JWT padrão.

Se o payload assinado mudar, **atualize** `jwt.type.ts` e os guards que assumem esses campos.

---

## Boas práticas

- **Nunca** commitar segredos; use apenas variáveis de ambiente (ver [env.md](env.md)).
- Preferir **uma única** configuração de JWT (módulo cipher + `EnvService`) para evitar instâncias com segredos diferentes.
- Para testes, mockar `JwtService` ou usar tokens com payload conhecido, alinhado a `JwtPayload`.

---

## Extensões futuras

Novos itens em `cipher/` podem seguir o mesmo padrão: módulo Nest isolado, dependência de `EnvModule`, tipos exportados em `*.type.ts` (ex.: refresh tokens, assinatura de webhooks com HMAC), sem misturar com regras de domínio.
