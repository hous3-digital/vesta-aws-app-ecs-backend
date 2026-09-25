# Catálogo de cenários — o que precisa estar testado

Fonte dos cenários: os 72 casos manuais da suíte de QA (`internal/qa-manual-tests-hous3/clients/vesta/manual-tests`, Regression Run #363, 60 OK / 9 BUG / 3 N/A) mais as regras de entidade que o QA não enxerga. Cada linha diz **qual camada é dona do caso** (`standard-test.mdc`) e **qual spec deve existir**. O nome do `it` começa pelo id do CT, então `grep CT-VESTA __tests__` mostra o que já está automatizado.

Objetivo imediato: **travar o comportamento de `/public/*` e do backoffice antes de mexer na fronteira de chain e nos módulos** (frentes F3 e F4 de `tech-debt.md`). Um refactor que passa nesta suíte não mudou o que o cliente vê.

Cobertura em 2026-09-24: `@unit` 53 testes (entidades e value objects cobertos), `@integration` 59, `@e2e` 11.

Legenda da coluna "hoje": `—` nada · `parcial` existe spec que cobre parte · `ok` coberto · `red` spec deve nascer falhando (bug aberto).

A coluna é verificada por `yarn catalog:check` (parte de `yarn lint`): todo CT presente em `__tests__` precisa de uma linha aqui com valor diferente de `—`, e o script falha quando um spec nasce sem atualizar o catálogo.

## Superfície e autenticação

| CT                                                           | Camada | Spec                             | Hoje                                                                                   |
| ------------------------------------------------------------ | ------ | -------------------------------- | -------------------------------------------------------------------------------------- |
| SURF-001 health retorna ok                                   | e2e    | `@e2e/surface.spec.ts`           | ok                                                                                     |
| SURF-002 JWKS responde JSON cru sem envelope                 | e2e    | `@e2e/surface.spec.ts`           | red (#360) — `@integration/controllers/wallet-jwks.controller.spec.ts` cobre o formato |
| SURF-003 rota SDK sem API key retorna 401                    | e2e    | `@e2e/surface.spec.ts`           | ok                                                                                     |
| SURF-004 API key inválida retorna 401                        | e2e    | `@e2e/surface.spec.ts`           | ok                                                                                     |
| SURF-005 Swagger fora de production                          | e2e    | `@e2e/surface.spec.ts`           | —                                                                                      |
| AUTH-001 login válido devolve token                          | e2e    | `@e2e/backoffice-auth.spec.ts`   | —                                                                                      |
| AUTH-002 login rejeita senha, user inativo, campos vazios    | e2e    | `@e2e/backoffice-auth.spec.ts`   | —                                                                                      |
| AUTH-003 `GET /backoffice/auth/me` com JWT válido e inválido | e2e    | `@e2e/backoffice-auth.spec.ts`   | —                                                                                      |
| AUTH-004 API key via `X-Api-Key` e via `Bearer`              | e2e    | `@e2e/surface.spec.ts`           | ok                                                                                     |
| AUTH-005 API key revogada deixa de autenticar                | e2e    | `@e2e/admin-api-keys.spec.ts`    | —                                                                                      |
| AUTH-006 issuer vem da chave, nunca do body                  | e2e    | `@e2e/public-credential.spec.ts` | —                                                                                      |

## Admin e onboarding do emissor

| CT                                                              | Camada                      | Spec                                                                                                         | Hoje                                                        |
| --------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| ADMIN-001 criar issuer com roles e provisionar wallet           | e2e                         | `@e2e/admin-issuers.spec.ts`                                                                                 | —                                                           |
| ADMIN-002 issuerId duplicado retorna 409                        | e2e                         | `@e2e/admin-issuers.spec.ts`                                                                                 | —                                                           |
| ADMIN-003 sem roles retorna 400                                 | e2e                         | `@e2e/admin-issuers.spec.ts`                                                                                 | —                                                           |
| ADMIN-004 provisionar ou recuperar wallet org                   | e2e + integration           | `@e2e/admin-issuers.spec.ts`; `@integration/services/wallet.service.spec.ts`                                 | parcial                                                     |
| ADMIN-005 registrar no registry com commissionTerms             | integration (chain mockada) | `@integration/services/issuer-registry.service.spec.ts`                                                      | parcial — registro repetido gera 2ª tx: decidir se é regra  |
| ADMIN-006 registry rejeita sem DID ou wallet ativa              | unit + integration          | `@unit/entities/issuer.spec.ts` (`isRegistryReady`); `@integration/services/issuer-registry.service.spec.ts` | parcial                                                     |
| ADMIN-007 criar usuário de backoffice, senha temporária uma vez | e2e                         | `@e2e/admin-backoffice-users.spec.ts`                                                                        | —                                                           |
| ADMIN-008 usuário duplicado retorna 409                         | e2e                         | `@e2e/admin-backoffice-users.spec.ts`                                                                        | —                                                           |
| ADMIN-009 criar, listar sem segredo, revogar API key            | e2e                         | `@e2e/admin-api-keys.spec.ts`                                                                                | red (#359: body inválido devolve 401 e não 400)             |
| ADMIN-010 admin sem secret ou secret inválido retorna 401       | e2e                         | `@e2e/surface.spec.ts`                                                                                       | ok                                                          |
| ADMIN-011 `POST /admin/payout-cycles/preview` não montado       | e2e                         | `@e2e/admin-payouts.spec.ts`                                                                                 | — (documentar como comportamento esperado ou montar a rota) |

## Credencial (`/public/credential`)

| CT                                                                   | Camada             | Spec                                                                                              | Hoje                                |
| -------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------- |
| CRED-001 emitir VC kycLevel complete                                 | e2e                | `@e2e/public-credential.spec.ts`                                                                  | ok                                  |
| CRED-002 emitir VC kycLevel pending                                  | e2e + unit         | `@e2e/public-credential.spec.ts`; `@unit/entities/credential.spec.ts` (`issuePending`)            | parcial (unit ok; e2e pendente)     |
| CRED-003 mesmo CPF retorna 409 `CPF_ALREADY_REGISTERED`              | e2e + integration  | `@e2e/public-credential.spec.ts`; `@integration/handlers/credential-public-issue.handler.spec.ts` | parcial (e2e ok; handler pendente)  |
| CRED-004 CPF REJECTED é apagado e permite nova emissão               | integration        | `@integration/handlers/credential-public-issue.handler.spec.ts`                                   | —                                   |
| CRED-005 validação de CPF, birthDate, fullName, campos extras        | e2e                | `@e2e/public-credential.spec.ts`                                                                  | ok                                  |
| CRED-006 issuer inativo ou inexistente retorna 422                   | integration + unit | handler de issue; `@unit/entities/issuer.spec.ts` (`isActive`, `canIssueCredentialType`)          | parcial (unit ok; handler pendente) |
| CRED-007 CPF não aparece na VC nem na linha                          | e2e                | `@e2e/public-credential.spec.ts` (inspeciona o banco)                                             | ok                                  |
| CRED-008 verify de ACTIVE retorna valid true e challengeNonce        | e2e                | `@e2e/public-credential.spec.ts`                                                                  | ok                                  |
| CRED-009 verify de pending, revoked, rejected, expired retorna false | unit + e2e         | `@unit/entities/credential.spec.ts` (`isApproved`, `isExpired`…); e2e por status                  | parcial (unit ok; e2e pendente)     |
| CRED-010 revogar a própria VC                                        | e2e + unit         | `@e2e/public-credential.spec.ts`; `@unit/entities/credential.spec.ts` (`revoke` duas vezes)       | ok                                  |
| CRED-011 revoke não checa dono da VC                                 | e2e + integration  | `@e2e/public-credential.spec.ts`; handler de revoke                                               | red (#354)                          |

## KYC assíncrono (`/public/credential/kyc-status`)

| CT                                                                | Camada             | Spec                                                                                                   | Hoje                                |
| ----------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| KYC-001 webhook aprova PENDING e atualiza kycLevel                | unit + integration | `credential.spec.ts` (`approve`); `@integration/handlers/credential-public-kyc-status.handler.spec.ts` | parcial (unit ok; handler pendente) |
| KYC-002 webhook rejeita PENDING                                   | unit + integration | `credential.spec.ts` (`reject`); mesmo handler                                                         | parcial (unit ok; handler pendente) |
| KYC-003 issuer diferente retorna 403 `CREDENTIAL_ISSUER_MISMATCH` | integration + e2e  | mesmo handler; `@e2e/public-credential.spec.ts`                                                        | —                                   |
| KYC-004 CPF inexistente 404, já ACTIVE 409                        | integration + unit | mesmo handler; `credential.spec.ts` (`approve` em ACTIVE)                                              | parcial (unit ok; handler pendente) |

## Passkey e challenge (`/public/auth`)

| CT                                                                      | Camada            | Spec                                                                                              | Hoje       |
| ----------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| PASS-001 challenge one-time de 60 s                                     | e2e               | `@e2e/public-auth.spec.ts`                                                                        | —          |
| PASS-002 challenge não reutilizável                                     | e2e               | `@e2e/public-auth.spec.ts`                                                                        | —          |
| PASS-003 registration options exige VC do issuer, aprovada, sem passkey | integration       | `@integration/services/passkey-auth.service.spec.ts`                                              | parcial    |
| PASS-004 registrar passkey e autenticar; counter antigo                 | integration + e2e | passkey-auth service; e2e precisa de **helper WebAuthn** (gerar credencial e assinatura em teste) | red (#361) |
| PASS-005 verify devolve proofChallenge, recoveryToken e JWT Privy       | e2e               | `@e2e/public-auth.spec.ts` com helper WebAuthn                                                    | —          |
| PASS-006 recusa VC revogada, expirada, não aprovada                     | integration       | passkey-auth service                                                                              | parcial    |
| RECOV-001 recover devolve a VC e recusa token reusado                   | integration + e2e | `@integration/services/credential-recovery.service.spec.ts`; `@e2e/public-auth.spec.ts`           | parcial    |

## Prova e atestação (`/public/proof`, `/public/attestations`)

| CT                                                                                        | Camada                         | Spec                                                                                           | Hoje                          |
| ----------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| PROOF-001 prepare gera prova e sessão com challenge legado                                | e2e (ZK real, arquivo próprio) | `@e2e/public-proof.spec.ts`                                                                    | — (smoke cobre, fora do jest) |
| PROOF-002 prepare rejeita challenge inválido, KYC insuficiente, privateInputs divergentes | integration                    | `@integration/handlers/proof-public-prepare.handler.spec.ts`                                   | —                             |
| PROOF-003 prepare recusa `ZK_MOCK_MODE=true` com contrato real                            | integration                    | mesmo handler                                                                                  | —                             |
| PROOF-004 issuer privyEnabled exige challenge kind=proof                                  | integration                    | mesmo handler                                                                                  | —                             |
| PROOF-005 submit-signed consome sessão, fee-bump, cria attestation                        | e2e (Stellar mock)             | `@e2e/public-proof.spec.ts`                                                                    | — (smoke cobre)               |
| PROOF-006 submit-signed recusa sessão inexistente, expirada, consumida                    | integration                    | `@integration/handlers/proof-public-submit-signed.handler.spec.ts`                             | parcial                       |
| PROOF-007 attestation cria lançamento PENDING_SECURITY                                    | integration                    | `@integration/repositories/attestation.repository.spec.ts` (regra no lugar errado, legacy map) | ok                            |
| PROOF-008 `/public/proof/submit` legado com prova pré-gerada; prova inválida vira 503     | integration + e2e              | `proof-public-submit.handler.spec.ts`                                                          | red (#362)                    |
| resolver issuer pela attestation                                                          | integration                    | `@integration/handlers/attestation-issuer-resolution.handler.spec.ts`                          | ok                            |

## Backoffice do emissor

| CT                                                  | Camada            | Spec                                                                                                  | Hoje                      |
| --------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------- |
| BO-001 profile e wallet do issuer logado            | e2e               | `@e2e/backoffice-profile.spec.ts`                                                                     | —                         |
| BO-002 activation start emite challenge de controle | e2e               | `@e2e/backoffice-profile.spec.ts` (confirm exige assinatura da wallet org: só o start e os negativos) | —                         |
| BO-003 trustline prepare recusa wallet sem controle | integration + e2e | `wallet.service.spec.ts`; e2e                                                                         | parcial                   |
| BO-004 lista e detalha credenciais sem PII          | e2e               | `@e2e/backoffice-credentials.spec.ts`                                                                 | —                         |
| BO-005 verificações, detalhe, export CSV            | e2e               | `@e2e/backoffice-verifications.spec.ts`                                                               | —                         |
| BO-006 verifiers escopados ao issuer do JWT         | e2e + unit        | `@e2e/backoffice-verifiers.spec.ts`; `@unit/entities/verifier.spec.ts`                                | red (#355, depende de D4) |
| BO-007 API keys só do próprio issuer                | e2e               | `@e2e/backoffice-api-keys.spec.ts`                                                                    | —                         |

## Comissão e payout

| CT                                                             | Camada      | Spec                                                      | Hoje    |
| -------------------------------------------------------------- | ----------- | --------------------------------------------------------- | ------- |
| COMM-001 balance mostra PENDING_SECURITY e promove após cutoff | integration | `@integration/services/commission-ledger.service.spec.ts` | parcial |
| COMM-002 crédito usa `COMMISSION_PER_VERIFICATION_BRL`         | integration | `attestation.repository.spec.ts`                          | ok      |
| PAY-001 readiness lista pré-requisitos                         | e2e         | `@e2e/backoffice-payouts.spec.ts`                         | —       |
| PAY-002 payout com Idempotency-Key 202 e rejeita segundo ativo | integration | `@integration/services/payout-request.service.spec.ts`    | parcial |
| PAY-003 issuer B não vê payouts nem ledger de A                | e2e         | `@e2e/backoffice-payouts.spec.ts`                         | —       |
| processor concilia payout desconhecido                         | integration | `payout-processor.service.spec.ts`                        | ok      |
| registro de comissão on-chain com retry                        | integration | `commission-registration-processor.service.spec.ts`       | ok      |

## Segurança transversal

| CT                                                                         | Camada                          | Spec                                       | Hoje                                                  |
| -------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| SEC-001 throttle 60/min global e limites menores em issue, prepare, revoke | e2e                             | `@e2e/surface.spec.ts`                     | —                                                     |
| SEC-002 CORS métodos e headers                                             | unit                            | `@unit/builders/cors.config.spec.ts`       | red (#356)                                            |
| SEC-003 campos extras rejeitados                                           | e2e                             | `@e2e/public-credential.spec.ts`           | —                                                     |
| SEC-004 API key em claro no banco                                          | e2e (inspeciona `api_keys.key`) | `@e2e/admin-api-keys.spec.ts`              | red (#357, corrigir é comportamental: chave hasheada) |
| SEC-005 ZK liga mock sozinho sem artefato                                  | integration                     | `@integration/services/zk.service.spec.ts` | red (#358)                                            |

## Regras de entidade sem CT (só `@unit`)

| Entidade      | Casos                                                                                                                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Credential`  | `issue` cria ACTIVE com `expiresAt`; `issuePending` cria PENDING; `revoke` em ACTIVE vira REVOKED e em REVOKED lança; `approve` só de PENDING; `reject` só de PENDING; `attachWallet` grava endereço e privyUserId; `isExpired` por data; `isApproved` só ACTIVE |
| `Issuer`      | `isActive`; `hasRole` por role; `canIssueCredentialType`; `isRegistryReady` exige DID e wallet ativa                                                                                                                                                             |
| `Verifier`    | `rename` muda nome e `updatedAt`; `revoke` e `reactivate` alternam status e recusam repetição                                                                                                                                                                    |
| `Attestation` | `create` grava `onChainResult` e ledger; imutável depois                                                                                                                                                                                                         |
| `Id`          | `create("credential")` gera prefixo; `restore` rejeita prefixo errado                                                                                                                                                                                            |
| `IssuerDid`   | formato `did:stellar:`; rejeita endereço inválido (hoje importa o SDK: F3)                                                                                                                                                                                       |

## Ordem sugerida (TDD antes das frentes F3 e F4)

1. `@unit/entities/*` para as quatro entidades e os dois value objects. Rápido e sem infraestrutura.
2. Infra de `@e2e`: `create-test-app.helper.ts`, `.env.test`, script `test:e2e` apontando para o Postgres do compose com banco `vesta_test`.
3. `@e2e/surface`, `public-credential`, `backoffice-auth`, `admin-issuers`: é o contrato do cliente em produção.
4. Os `red` dos bugs #354, #359, #356: spec falhando, depois o fix.
5. `@e2e/public-proof` com ZK real, arquivo próprio, timeout alto.
6. Helper WebAuthn para PASS-004 e PASS-005.
