# Relatório de Auditoria Técnica — `vesta-aws-app-ecs-backend`

**Escopo:** Segurança · Arquitetura & Padrões · Testes · Documentação
**Público-alvo:** Liderança técnica (uso interno)
**Data:** 15/09/2026 (revisão complementar 17/09/2026: ambiente local, Privy, seeds, isolamento de staging)
**Referência de padrão:** padrão mínimo de engenharia adotado internamente pela empresa em projetos equivalentes (mesma stack: NestJS 11 / TypeScript 5.9 / Prisma 7).

---

## 1. Sumário executivo

O `vesta-aws-app-ecs-backend` **funciona**, tem uma stack moderna e adequada (NestJS, CQRS, Zod, Prisma, throttler global, WebAuthn, ZK) e traz sinais de boa intenção arquitetural (documentação de padrões, alguns módulos bem modelados). Porém, a execução é **inconsistente e negligente em pontos que afetam diretamente segurança e maturidade** — exatamente os critérios que uma avaliação de grant como o Stellar Community Fund (SCF) observa quando julga se um projeto está pronto para receber e custodiar recursos.

Os problemas mais graves:

1. **Chaves de API armazenadas em texto puro no banco** (sem hash) — mesmo o projeto já usando `bcrypt` para senhas do backoffice. Um vazamento de dump do banco compromete todas as integrações de todos os issuers de imediato.
2. **1.116 arquivos de build/binários versionados no Git** (saída de compilação Rust: `.rlib`, `.exe`, `.pdb`), representando ~78% dos arquivos rastreados do repositório. Além de inflar o repo, é uma falha de higiene e superfície de supply-chain.
3. **Revogação pública sem checar o issuer dono da VC** — qualquer API key válida revoga credencial de qualquer banco.
4. **Isolamento de ambiente inexistente na prática** — máquina local facilmente aponta RDS/Privy/S-keys/contratos de staging; deployer e operator de payout compartilham a mesma chave, contra o próprio README do vault.

**Veredito:** o projeto está **abaixo do padrão mínimo** que consideramos aceitável para a empresa. Nenhum dos problemas é irreversível, mas o conjunto passa a impressão de código não revisado — risco reputacional real numa avaliação de due diligence técnica do SCF. Também **não dá para reproduzir staging no notebook sem copiar segredos de homologação**: seeds de produto estavam vazios, o SDK só fala com staging/prod, e a Privy (integrada de verdade) exige app + chave JWT próprios.

### Placar por severidade

| Severidade | Qtde | Itens |
|---|---|---|
| 🔴 Crítico | 3 | S-01, S-02, S-09 |
| 🟠 Alto | 9 | S-03, S-04, S-07, S-08, S-10, A-01, A-02, A-08, T-01 |
| 🟡 Médio | 8 | S-05, S-06, A-03, A-04, A-05, A-07, D-01, D-03 |
| 🔵 Baixo | 2 | A-06, D-02 |

---

## 2. Metodologia e legenda

Análise estática do código-fonte, configurações (`tsconfig`, `eslint`, `jest`, env schema), estrutura de pastas, arquivos rastreados pelo Git e documentação. Cada achado traz **evidência (arquivo:linha)**, **por que é crítico**, **impacto no SCF** e **remediação com estimativa de esforço**.

| Nível | Definição |
|---|---|
| 🔴 **Crítico** | Risco de segurança/dados explorável ou perda de credibilidade imediata. Corrigir antes de qualquer submissão/deploy sério. |
| 🟠 **Alto** | Compromete segurança, manutenibilidade ou avaliação de maturidade. Corrigir no curto prazo. |
| 🟡 **Médio** | Débito técnico relevante; corrói qualidade e passa impressão de descuido. |
| 🔵 **Baixo** | Cosmético / higiene; barato de corrigir, alto retorno de percepção. |

**Esforço:** P = até meio dia · M = 1–3 dias · G = > 3 dias.

---

## 3. Segurança

### 🔴 S-01 — API Keys armazenadas em texto puro no banco
**Evidência:** `app/src/infra/auth/api-key.service.ts:11-17` (busca por `where: { key }`) e `:24-33` (`create` grava `key: vesta_live_<hex>` em claro). Agravante: o projeto **já usa `bcrypt` para senhas do backoffice** (`app/src/infra/auth/backoffice-auth.service.ts:7,35`, via `bcrypt.compare`) — ou seja, o padrão de hashing existe no código e simplesmente **não foi aplicado às API keys**.

```
const record = await this.prisma.apiKey.findFirst({
  where: { key, active: true, issuerId: { not: null } }, // <- compara a chave crua
```

**Por que é crítico:** qualquer leitura do banco (backup, dump, replica, log de query, acesso indevido, SQL injection em outro ponto) expõe **todas as chaves de API ativas em claro**, permitindo que um atacante se passe por qualquer issuer. É a diferença entre "vazou o banco" e "vazou o banco e todas as credenciais junto".
**Impacto no SCF:** custódia de credenciais é justamente o produto da Vesta (emissão de VCs). Armazenar segredos de autenticação sem hash é um red flag clássico de auditoria de segurança.
**Remediação:** guardar apenas hash da chave (SHA-256 com peppering via `CPF_HMAC_SECRET`-equivalente, ou `bcrypt`/`argon2`); expor a chave crua **uma única vez** na criação; lookup por hash. Migração para re-emitir chaves existentes. **Esforço: M.**

### 🔴 S-02 — Binários e artefatos de build versionados no Git
**Evidência:** `git ls-files` retorna **1.116 arquivos** sob `app/contracts/vesta-verifier/target/` (`.rlib`, `.rmeta`, `.exe`, `.pdb`, `.d`, timestamps de fingerprint), de um total de **1.431 arquivos rastreados** (~78%). Também há código gerado do Prisma (`app/src/infra/database/@prisma/generated/models/*.ts`) e o artefato `app/zk-artifacts/vesta_kyc_final.zkey` versionados.
O `.gitignore` **até tenta** ignorar (`**/target/`), mas os arquivos foram commitados antes da regra e nunca removidos do índice. Pior: a regra `/src/infra/database/@prisma/generated` está com o caminho errado (deveria ser `app/src/...`), por isso o código gerado continua rastreado.

**Por que é crítico:** binários compilados no repositório são superfície de supply-chain (ninguém revisa um `.exe`/`.rlib` num PR), inflam o clone, poluem o histórico e demonstram que os PRs não estão sendo revisados com atenção. `.gitignore` presente mas ineficaz é sinal claro de "colou a regra e não conferiu".
**Impacto no SCF:** projetos blockchain são avaliados por reprodutibilidade de build e integridade da cadeia de artefatos. Binários versionados vão contra isso.
**Remediação:** `git rm -r --cached app/contracts/**/target app/src/infra/database/@prisma/generated`; corrigir o path do `.gitignore`; decidir política para o `.zkey` (LFS ou release asset). **Esforço: P** (a correção; validar histórico é M).

### 🟠 S-03 — Segredos de segurança são opcionais no schema de ambiente
**Evidência:** `app/src/infra/env/env.schema.ts:36-41` — `ADMIN_SECRET`, `BACKOFFICE_JWT_SECRET` e `PRIVY_APP_SECRET` estão todos como `.optional()`. Não há exigência condicional por ambiente (nada obriga que existam em `production`).

**Por que é crítico:** a aplicação **sobe em produção sem** secret de admin e sem secret de JWT do backoffice. Combinado com o S-04 (fallback), a superfície de erro operacional é grande: subir prod com autenticação mal configurada e ninguém perceber no boot.
**Impacto no SCF:** validação de configuração fail-fast é esperada em software maduro.
**Remediação:** tornar esses segredos obrigatórios quando `NODE_ENV=production` (refino condicional no Zod). **Esforço: P.**

### 🟠 S-04 — Reuso de segredo: JWT do backoffice cai para o `ADMIN_SECRET`
**Evidência:** `app/src/infra/auth/backoffice-auth.service.ts:107` — `const secret = this.envService.BACKOFFICE_JWT_SECRET ?? this.envService.ADMIN_SECRET;` (usado para assinar em `:84`). O próprio `.env.example:42` avisa "deve ser diferente do ADMIN_SECRET", mas o código faz o fallback silencioso.

**Por que é crítico:** dois contextos de segurança distintos (autorização de admin por header e assinatura de sessão JWT) passam a compartilhar a mesma chave. Comprometer um compromete o outro; rotação fica acoplada.
**Remediação:** remover o fallback; exigir `BACKOFFICE_JWT_SECRET` próprio (ver S-03). **Esforço: P.**

### 🟡 S-05 — Comparação de segredo não constant-time + vazamento parcial em log
**Evidência:** `app/src/infra/auth/admin-secret.guard.ts:20` — `provided !== adminSecret` (comparação de string sensível a timing). `app/src/infra/auth/api-key.guard.ts:38` — loga `apiKey.slice(0, 12)` de chaves inválidas.

**Por que é crítico:** comparação direta de segredo abre janela (pequena, porém real) para timing attack; logar prefixo de chave polui logs com material sensível.
**Remediação:** `crypto.timingSafeEqual`; não logar material de chave. **Esforço: P.**

### 🟡 S-06 — `JwtService` instanciado com `new` fora da injeção de dependência
**Evidência:** `app/src/modules/wallet/wallet.service.ts:92` — `private readonly jwtService: JwtService = new JwtService()` e assina token em `:415`.

**Por que é crítico:** contorna o container de DI e a configuração central do Nest, dificultando garantir qual segredo/algoritmo está em uso e testar. Anti-padrão que pode levar a token assinado com configuração default inesperada.
**Remediação:** injetar `JwtService` via módulo configurado. **Esforço: P.**

### 🟠 S-07 — Deployer e operator de payout são a mesma chave Stellar
**Evidência:** `app/contracts/vesta-payout-vault/README.md` (roles): *“operator: use a dedicated payout key, never the verifier deployer key”*. O script de deploy faz o oposto: `app/src/scripts/deploy-payout-vault.ts:133` devolve `operatorAddress: this.deployer.publicKey()` e exige que `VESTA_DEPLOYER_SECRET` seja o issuer do ativo BRL (`:105-107`). No ambiente de staging observado, `VESTA_DEPLOYER_SECRET` e `STELLAR_PAYOUT_OPERATOR_SECRET` são a **mesma** S-key.

**Por que é crítico:** quem tem a chave de deploy (subir/atualizar contratos, financiar contas, emitir BRL) também assina `settle` do vault. Um vazamento só drena o cofre de comissão. O documento do contrato já sabia disso; o código e o staging ignoram.
**Impacto no SCF:** governança on-chain de tesouraria é critério clássico de due diligence em projeto Soroban.
**Remediação:** após `initialize`, trocar o role `operator` para um keypair distinto; persistir só essa S-key em `STELLAR_PAYOUT_OPERATOR_SECRET`; nunca reutilizar a de staging no notebook. **Esforço: P–M.**

### 🟠 S-08 — `ZK_MOCK_MODE=false` liga mock sozinho se faltar artefato
**Evidência:** `app/src/modules/zk/zk.service.ts:35-42` — se wasm/zkey não existem, o boot **força mock** e só loga erro. O prepare recusa mock + contrato real (`proof-public-prepare.handler.ts`, 400), mas o operador vê `ZK_MOCK_MODE=false` no `.env` e acredita que a prova é Groth16. No workspace, `verification_key.json` existe; `vesta_kyc.wasm` / `vesta_kyc_final.zkey` **não**.

**Por que é crítico:** ambiente “de verdade” sobe mudo em modo fake. Combina mal com S-10: alguém aponta contrato de staging, esquece o zkey, e acha que testou on-chain.
**Remediação:** falhar o boot se `ZK_MOCK_MODE=false` e faltar artefato; versionar/distribuir wasm+zkey por canal controlado (não regenerar trusted setup). **Esforço: P.**

### 🔴 S-09 — `POST /public/credential/revoke` não valida o issuer dono
**Evidência:** `app/src/modules/credential/application/public/handlers/credential-public-revoke.handler.ts:18-26` — busca por `vcHash`, chama `revoke()`, persiste. Não compara `credential.issuerId` com o issuer da API key (`request.apiKey`). A emissão **sim** amarra a key ao issuer.

**Por que é crítico:** qualquer integrador com uma `vesta_live_*` válida revoga VC de outro banco. Produto de credencial verificável em que o concorrente (ou um key vazado, ver S-01) apaga o ativo do vizinho.
**Impacto no SCF:** falha de autorização no fluxo central do produto.
**Remediação:** 403 se o issuer da key não for o dono; teste de regressão cruzando duas keys. **Esforço: P.**

### 🟠 S-10 — Isolamento de ambiente não existe (Privy, RDS, HMAC, contratos)
**Evidência (código + prática de setup):**
- Schema Zod não impede `DATABASE_URL` de RDS, `PRIVY_APP_*` de staging ou `VESTA_CONTRACT_ID` de homologação no `NODE_ENV=local`.
- Custom auth Privy: Nest assina JWT ES256 60s (`wallet.service.ts:411-427`); o **servidor da Privy** valida com JWKS URL ou PEM. `http://localhost:3000/.well-known/jwks.json` **não é alcançável** pela nuvem deles — localhost no dashboard é a máquina da Privy.
- SDK bakeia `PRIVY_APP_ID` no build (`vesta-sdk/app/scripts/generate-privy-config.js`). Um app = um JWKS. Trocar o JWKS do app de staging para localhost **quebra homologação**.
- `CPF_HMAC_SECRET` compartilhado entre local e staging faz colisão/dedup cruzar ambientes.

**Por que é crítico:** o caminho “mais fácil” de testar Privy/on-chain no notebook é colar o `.env` de staging. Isso escreve no RDS de homologação, cria users no app Privy de staging e assina o ledger de testnet com a S-key de tesouraria (S-07). Não é falha de um arquivo — é ausência de trilha de ambiente.
**Remediação:** app Privy **Developer** separado (plano gratuito, suficiente para teste); colar PEM público na dashboard (evita ngrok); secrets gerados; contratos próprios na Testnet; HMAC próprio. Documentar isso no README. **Esforço: M** (processo + um dia de setup; não é refatoração grande).

---

## 4. Arquitetura & Padrões

### 🟠 A-01 — Não existe um padrão arquitetural único (4 estilos convivendo)
**Evidência (inventário dos 10 módulos):**

| Módulo | Padrão | Observação |
|---|---|---|
| `credential` | ✅ DDD/CQRS completo | api/application/domain/infra |
| `proof` | ✅ DDD/CQRS completo | api/application/domain/infra |
| `issuer` | ⚠️ parcial | domain+infra, mas gateways/services soltos na raiz |
| `backoffice` | ⚠️ padrão próprio | sub-módulos por feature, sem domain/infra no topo; usa sufixo `.dao.ts` |
| `commission` | ❌ flat | **10 arquivos na raiz** misturando controllers, gateways e services |
| `challenge` | ❌ flat | services na raiz + `api/` |
| `stellar` / `vc` / `zk` | ❌ flat | service único na raiz |
| `wallet` | ❌ flat | service + controller na raiz |

**Por que é crítico:** cada módulo exige que o desenvolvedor reaprenda "onde as coisas ficam". Isso aumenta o custo de manutenção, o risco de bug ao mexer, e sinaliza ausência de code review consistente. Módulos que carregam lógica sensível (ex.: `commission` — payouts on-chain) estão entre os mais bagunçados.
**Impacto no SCF:** organização e arquitetura são critérios explícitos de avaliação de maturidade do projeto.
**Remediação:** eleger o padrão DDD/CQRS já documentado como único; refatorar incrementalmente os módulos flat (começar por `commission`). **Esforço: G.**

### 🟠 A-02 — A documentação prescreve um padrão que o código majoritariamente viola
**Evidência:** `app/docs/architecture.md` ("Consulte este documento antes de implementar novas funcionalidades") e `app/docs/modules.md` descrevem DDD + CQRS + Repository/DAO como o padrão obrigatório. Na prática, 8 dos 10 módulos não o seguem.

**Por que é crítico:** documentação que não reflete a realidade é pior que nenhuma — cria falsa confiança e confunde quem chega. Também sugere que a doc foi herdada de um template e não mantida.
**Remediação:** ou alinhar o código à doc (preferível), ou a doc à realidade e criar plano de convergência. **Esforço: M.**

### 🟡 A-03 — Nomenclatura inconsistente entre módulos
**Evidência:** `credential/infra/credential.data-access-object.ts` vs `backoffice/.../credentials-backoffice.dao.ts` (dois sufixos para o mesmo conceito); `commission/commission-onchain-identifiers.ts` **sem sufixo de papel**; entidades ora em `domain/x.entity.ts` (achatado), ora esperadas em subpastas conforme a doc.
**Remediação:** convenção única de nomes/sufixos + lint de nomenclatura. **Esforço: P–M.**

### 🟡 A-04 — Configuração de TypeScript permissiva (type-safety fraca)
**Evidência:** `app/tsconfig.json` — sem `"strict": true`; `"noImplicitAny": false`, `"strictBindCallApply": false`, `"forceConsistentCasingInFileNames": false`, `"noFallthroughCasesInSwitch": false`. Resultado observado: **59** ocorrências de `any`/`as any` e **50** supressões (`@ts-ignore`/`eslint-disable`) em `src/`.

**Por que é crítico:** o principal benefício de usar TypeScript (segurança de tipos) está parcialmente desligado. `any` e `@ts-ignore` mascaram bugs que só aparecem em runtime — em fluxo de dinheiro/on-chain isso é caro.
**Remediação:** ligar `strict`, zerar supressões incrementalmente. **Esforço: M–G.**

### 🟡 A-05 — ESLint fraco e autoexcluído do type-check
**Evidência:** `app/eslint.config.js` começa com `// @ts-nocheck` e `// @ts-ignore`; aplica apenas `js.configs.recommended` (não `tseslint.configs.recommended`); `no-explicit-any` e `no-console` **não** estão habilitados.

**Por que é crítico:** o lint não protege qualidade de TypeScript — explica os números de `any` e os **30 `console.log`** em `src/` (em vez do logger Winston já configurado). Um lint que não pega os problemas dá falsa sensação de rede de proteção.
**Remediação:** adotar preset type-aware do `typescript-eslint`, habilitar `no-explicit-any`/`no-console`. **Esforço: P–M.**

### 🔵 A-06 — Resíduos de template não limpos
**Evidência:** `package.json:2` ainda `"name": "backend-template"`, `version: 0.0.1`, sem `description`/`author`, `license: UNLICENSED`. `config/jest-unit.config.ts` e `tsconfig` declaram aliases inexistentes no projeto (`@core`, `@supporting`, `@generic`, `@providers`, `@artifacts`).
**Remediação:** ajustar metadados e remover aliases mortos. **Esforço: P.**

### 🟡 A-07 — Seeds de produto inexistentes; bootstrap só por HTTP admin
**Evidência:** até 17/09/2026, `seeds/index.ts` lia `base.seed.sql` e `dev.seed.sql` **que não existiam** (seed crashava) e `e2e.seed.sql` era um comentário. Issuer, API key e user de backoffice só nascem em `POST /admin/issuers`, `/admin/api-keys`, `/admin/backoffice-users` (`admin-issuers.controller.ts`, `api-key.service.ts`). Não há `docker-compose` no repo, embora `package.json` tenha `yarn docker:up`.

**Por que é crítico:** ambiente novo = banco oco + ritual oral de curls. Estimula copiar staging (S-10). Sem fixture, CI/e2e não tem issuer estável.
**Remediação iniciada (17/09):** `local-fixtures.sql` + runner só em `local`/`development`/`test` (issuer `local_bank`, key `vesta_live_local_dev_…`, `dev@localhost` / `vesta_local`, `privyEnabled=false`). Ainda falta: compose ou instrução de Postgres nativo; `privyEnabled` continua off até existir app Privy próprio.
**Esforço restante: P.**

### 🟠 A-08 — SDK não tem ambiente local (cai em staging)
**Evidência:** `vesta-sdk/app/src/http/client.ts:38-51` — `VestaEnvironment` só `STAGING` | `PRODUCTION`; `resolveBaseUrl` ignora qualquer override. O JSDoc de `VestaSDKConfig` (`types.ts:122`) documenta `apiUrl` que **não existe na interface**. Default sem `environment` = `https://vesta.trust-staging.com`. O backoffice, por contraste, já tem `VITE_VESTA_API_BASE_URL`.

**Por que é crítico:** o pacote publicado **não consegue** testar contra `localhost:3000`. Integrador (e o próprio time) aponta o SDK para staging mesmo com Nest local. Combina com S-10.
**Remediação:** `apiUrl?: string` em `resolveBaseUrl`; enum `LOCAL` opcional; `yarn link` no playground. **Esforço: P.**

---

## 5. Testes

### 🟠 T-01 — Cobertura baixíssima, não medida e mal organizada
**Evidência:** apenas **17** arquivos `*.spec.ts`, todos em `app/__tests__/@unit/` (pasta única, sem `integration`/`e2e` embora `package.json:34-36` tenha scripts para eles). `config/jest-unit.config.ts` **não define `coverageThreshold`** (nenhum mínimo é exigido). Existe `__tests__/@unit/example.spec.ts` com o comentário literal *"Este é um teste de exemplo, devem deletar esse arquivo e escrever testes correspondentes."*

**Por que é crítico:** módulos inteiros e sensíveis (emissão/verificação/revogação de credenciais, handlers de proof, `wallet`, repositórios de `issuer`, todo o `backoffice`) estão sem testes. Sem threshold, a cobertura pode cair a zero sem quebrar o CI. O `example.spec` boilerplate ainda no repo reforça a percepção de descuido.
**Impacto no SCF:** confiabilidade e testabilidade são critérios de maturidade; software que custodia credenciais/valores sem testes de regressão é risco alto.
**Remediação:** definir `coverageThreshold` (ex.: 60% e subir), remover `example.spec`, priorizar testes dos fluxos de credential/proof/payout, criar as pastas integration/e2e que os scripts já esperam. **Esforço: G.**

---

## 6. Documentação

### 🟡 D-01 — README desatualizado em relação ao código real
**Evidência:** `README.md:24-31` lista apenas 6 módulos (`challenge`, `credential`, `proof`, `stellar`, `vc`, `zk`) e **omite** `commission`, `issuer`, `backoffice` e `wallet` — que existem e contêm lógica crítica (payouts on-chain, registro de issuers, backoffice autenticado). Também há divergência README×`.env.example` (ex.: `ZK_MOCK_MODE` `"true"` no README vs `"false"` no exemplo).

**Por que é crítico:** os módulos financeiros mais sensíveis são justamente os que "não existem" na documentação. Onboarding e auditoria externa partem de informação incompleta.
**Remediação:** sincronizar README/docs com o código; automatizar checagem quando possível. **Esforço: P–M.**

### 🟡 D-03 — Setup local/Privy não documentado (e o que existe está errado)
**Evidência:** README pede `yarn docker:up` sem compose no repo; lista env incompleta (omite Privy, payout, admin, WebAuthn); `ZK_MOCK_MODE` diverge README×`.env.example`. A integração Privy (Passkey → JWT custom 60s → `syncWithToken` no browser → iframe assina Stellar) **não está descrita** para um ambiente isolado. Quem entra no projeto nesta semana só descobre que (a) Privy é o cofre, não o login; (b) JWKS `localhost` não funciona se a dashboard usar URL; (c) precisa app Developer separado e PEM colado.

**Por que é crítico:** onboarding vira “copia o `.env` de staging”. É o mecanismo social do S-10.
**Remediação:** página de “ambiente local fiel” — Postgres nativo, fixtures, app Privy, PEM vs ngrok, deployer ≠ operator, `apiUrl` do SDK. **Esforço: P–M.**

### 🔵 D-02 — Logs de startup por `console.log` e ruído de diagnóstico
**Evidência:** `app/src/main.ts:35-44,110+` faz o bootstrap inteiro com `console.log("[STARTUP] ...")` em vez do logger estruturado (Winston já está configurado logo abaixo).
**Remediação:** padronizar via logger; manter apenas o essencial. **Esforço: P.**

---

## 7. Impacto consolidado no Stellar SCF

O SCF avalia, entre outros pontos, **maturidade técnica, segurança e organização do projeto**. Mapeando os achados a esses eixos:

| Eixo de avaliação | Achados que pesam contra | Risco |
|---|---|---|
| Segurança / custódia | S-01, S-03, S-04, S-05, S-07, S-09 | Alto |
| Isolamento de ambiente / Privy | S-08, S-10, A-07, A-08, D-03 | Alto |
| Integridade de build / supply-chain | S-02 | Alto |
| Arquitetura & organização | A-01, A-02, A-03 | Alto |
| Qualidade de engenharia | A-04, A-05, A-06 | Médio |
| Confiabilidade / testes | T-01 | Alto |
| Transparência / documentação | D-01, D-02, D-03 | Médio |

**Conclusão para o SCF:** os itens 🔴/🟠 são exatamente o tipo de coisa que um revisor técnico encontra em 15 minutos de leitura do repositório e usa para questionar a prontidão do time. São, porém, **todos corrigíveis** — e vários com esforço P.

---

## 8. Plano de remediação priorizado

**Fase 1 — antes de qualquer submissão/deploy sério (dias):**
1. S-01 hash de API keys · 2. S-09 revoke só do issuer dono · 3. S-02 remover binários do Git + corrigir `.gitignore` · 4. S-03/S-04 tornar segredos obrigatórios e remover fallback · 5. S-07 operator ≠ deployer (staging + script) · 6. S-05/S-06 constant-time + DI do JwtService · 7. S-08 falhar boot sem artefato ZK · 8. remover `example.spec` e definir `coverageThreshold` mínimo.

**Fase 1b — trilha local sem staging (paralelo, ~1–2 dias de setup):**
9. S-10 app Privy Developer + PEM no dashboard (sem ngrok) + secrets gerados · 10. A-08 `apiUrl` no SDK · 11. A-07 concluir fixtures (`privyEnabled` quando o app existir) · 12. D-03 documentar o caminho local fiel.

**Fase 2 — maturidade (1–2 semanas):**
13. Ligar `tsconfig` strict + ESLint type-aware (A-04/A-05) · 14. Sincronizar README/docs (D-01) · 15. Padronizar nomenclatura e limpar resíduos de template (A-03/A-06/D-02).

**Fase 3 — convergência arquitetural (contínuo):**
16. Refatorar módulos flat para o padrão DDD/CQRS único, começando por `commission` (A-01/A-02) · 17. Elevar cobertura de testes dos fluxos críticos (T-01).

---

## 9. Privy — o que o time precisa saber (1 página)

A Privy **já está integrada**. Não é login com e-mail: a Vesta autentica por Passkey; a Privy é o **cofre** da chave Stellar e quem assina a transação no browser (iframe).

1. Na emissão, o Nest chama `importUser` e nasce uma wallet Stellar. O deployer financia 1,5 XLM on-chain (`ensureAccountExists`).
2. Na Passkey, o Nest assina um JWT ES256 de 60s (`iss=vesta`, `aud=App ID`).
3. O SDK faz `syncWithToken`; **os servidores da Privy** validam esse JWT.
4. A prova on-chain: Nest monta tx unsigned; Privy assina; Nest faz fee-bump.

**Criar um app novo para local é gratuito** (plano Developer). Não se reutiliza o app de staging: um App ID = um JWKS. Trocar o JWKS de staging para localhost derruba homologação.

**Ngrok só é necessário se a dashboard usar “JWKS URL”.** A Privy também aceita **colar o PEM público**. Para notebook, cole a chave — `localhost` na URL do JWKS é a máquina da Privy, não a sua.

O issuer da seed local está com `privyEnabled=false` de propósito: sem app próprio, a emissão tentaria `importUser` no app errado.

---

## 10. Nota de tom

Este relatório avalia **o estado do código**, não a pessoa que o escreveu. A base tem méritos (stack correta, módulos-modelo, documentação existente) e nenhum dos problemas é irreversível. O objetivo é elevar o projeto ao **padrão mínimo de engenharia da empresa** e blindá-lo para a avaliação do SCF — não atribuir culpa.
