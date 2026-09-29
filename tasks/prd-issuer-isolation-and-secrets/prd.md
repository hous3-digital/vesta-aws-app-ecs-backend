# PRD: Isolamento entre issuers e segredos obrigatórios (restante da F3)

Track feature: `feature_01m37qasbne4fr7pfvhhkpbk9z` (release `release_01m1feb76ye8mvg4vseke2b7s3`, R4). Cobre F3-001, F3-003 a F3-006 e as duas tasks de operação sem RF. O F3-002 (API keys com hash) tem PRD próprio em `tasks/prd-api-key-hash/`.

| Track task                        | Origem                                   | RF da feature | EP  |
| --------------------------------- | ---------------------------------------- | ------------- | --- |
| `task_01m37yf3hbesj9535vyn11hnpe` | CRED-011 #354 / S-09                     | F3-001        | 3   |
| `task_01m37yf3jresj9536byana8w0e` | S-03 / S-04 / S-06 / TD-006 / SUB-008    | F3-003        | 3   |
| `task_01m37yf3k9esj9536m34qf9dtr` | PASS-004 #361                            | F3-004        | 3   |
| `task_01m37yf3ksesj9536x84xhfva4` | SEC-005 #358 / S-08                      | F3-005        | 3   |
| `task_01m37yf3maesj953734p5d17yk` | BO-006 #355 / D4 (global, 2026-09-28)    | F3-006        | 5   |
| `task_01m3b6457qf6btcgk3nh9y5k5d` | `yarn deploy:check`, SUB-001 a 006 e 009 | —             | 3   |
| `task_01m3b6458sf6btcgk81csqxeat` | SUB-010                                  | —             | 3   |

## Problem

A auditoria e a regression de QA (#354 a #362) acharam na API em produção: qualquer API key ativa revoga credencial de outro issuer se souber o `vcHash`; qualquer usuário de backoffice edita o catálogo inteiro de verifiers; os segredos de borda são opcionais, o JWT cai para `ADMIN_SECRET`, o admin secret é comparado com `!==` (TD-006) e o token de staging nunca expira (SUB-008); a passkey estoura 500 em falha de verificação e ignora counter regressivo; o ZK liga o mock sozinho quando faltam artefatos. Fora do código, `yarn deploy:check` acusa deriva entre tfvars e Secrets Manager (SUB-001 a 006, 009) e sete segredos de staging foram expostos em 2026-09-24 (SUB-010).

## Goals

- Nenhuma rota lê ou altera dado de outro issuer.
- Produção não sobe sem os segredos de borda; nenhum segredo cai para outro nem é comparado em tempo variável.
- Nenhum 500 por entrada inválida na passkey; counter regressivo vira 4xx com rastro.
- Deploy com `ZK_MOCK_MODE=false` e sem artefato falha antes de servir prova mock.
- `yarn deploy:check` limpo nos dois ambientes e SUB-010 fechada sem nenhum valor passar por repo, PR, log ou chat.

## Users and stories

- Como issuer técnico, quero que só a minha key revogue as minhas credenciais, para outro cliente não afetar meus usuários.
- Como issuer técnico, quero ver no backoffice só o que é meu, ou um catálogo que não consigo alterar.
- Como operador Vesta, quero que a API se recuse a subir mal configurada, para achar o erro no deploy e não num incidente.
- Como titular, quero que uma passkey clonada seja recusada e registrada.

## Functional requirements

- **RF-001** `POST /public/credential/revoke` só revoga credencial cujo `issuerId` é o da key autenticada; `vcHash` de outro issuer responde 404, igual a inexistente (mesma regra de tenant da feature de API key: issuer na query, nunca 403). Teste cruzando duas keys; CT CRED-011 reescrito.
- **RF-002** `ADMIN_SECRET` e `BACKOFFICE_JWT_SECRET` obrigatórios em todo `NODE_ENV` diferente de `local`; `PRIVY_APP_SECRET` obrigatório em `production`. O boot falha nomeando a variável, nunca o valor. Staging roda com `NODE_ENV=test` (SUB-006), por isso a regra é "fora de local".
- **RF-003** JWT do backoffice usa só `BACKOFFICE_JWT_SECRET`, sem fallback; todo token tem `exp`; `never` rejeitado fora de `local`, default `8h`. Tfvars de staging passa a `8h` no mesmo PR (SUB-008).
- **RF-004** Admin secret comparado em tempo constante; tamanho ou valor diferente respondem o mesmo 401. Fecha TD-006.
- **RF-005** Nenhum log traz prefixo de challenge, de DID de sujeito nem de app id da Privy: fica o evento, sai o valor.
- **RF-006** Falha de `verifyRegistrationResponse` ou `verifyAuthenticationResponse` responde 400 com código estável, nunca 500.
- **RF-007** Counter menor ou igual ao guardado responde 403 com código estável, não atualiza a passkey e grava log de segurança com issuer id e passkey id.
- **RF-008** Com `ZK_MOCK_MODE=false` e artefato ausente o boot falha em qualquer ambiente, nomeando o caminho esperado; local e jest já declaram o modo. A imagem prova no build que contém os artefatos; staging e prod rodam com ZK real (Victor, 2026-09-28).
- **RF-009** Catálogo de verifiers global (D4 decidida em 2026-09-28): o issuer continua lendo o catálogo no backoffice; criar e mudar status passam a rotas de admin com admin secret; sem migration. CT BO-006 reescrito.
- **RF-010** `yarn deploy:check` limpo em staging e prod; SUB-001 a 006 e 009 fechados com data; decisões (Privy em prod, payout, nome do perfil de staging) em `decisions.md`.
- **RF-011** Rotação em staging de `PRIVY_APP_SECRET`, `PRIVY_CUSTOM_AUTH_PRIVATE_KEY` e `KEY_ID`, `DATABASE_URL`, `VESTA_DEPLOYER_SECRET`. `CPF_HMAC_SECRET` fica: risco aceito em 2026-09-28. `ADMIN_SECRET` e `BACKOFFICE_JWT_SECRET` já rotacionados em staging e prod (Victor, 2026-09-28): registrar a data e riscar.

## Change class

| Rota ou comportamento               | Classe         | Observação                                                            |
| ----------------------------------- | -------------- | --------------------------------------------------------------------- |
| `POST /public/credential/revoke`    | Comportamental | key de outro issuer passa de 200 a 404; confirmar no mapa de uso (D6) |
| Login e rotas com JWT do backoffice | Aditiva        | token ganha `exp`; usuários de staging fazem login de novo            |
| Rotas `/admin/*`                    | Aditiva        | mesmo 401                                                             |
| Passkey: registro e autenticação    | Aditiva        | só o caminho de erro muda, de 500 para 4xx                            |
| `/backoffice/admin/verifiers`       | Comportamental | escrita sai do backoffice e vai para `/admin`; leitura não muda       |
| Boot da API                         | Operacional    | derruba deploy mal configurado, que é o objetivo                      |

## Constraints

- Segredo nunca em log, fixture, spec, commit, PR ou chat (`AGENTS.md`, rule 5; `standard-security`). Valores novos só no Secrets Manager.
- Sem migration nesta feature (D4 global). Toda mudança de env ou tfvars tem linha no `deploy-checklist.md` no mesmo commit.
- Ordem: RF-011 antes de RF-002 e RF-003 subirem em staging; RF-010 antes de RF-008, para saber se as imagens têm os artefatos.
- As tasks de operação dependem de console AWS, RDS, Privy e conta Stellar de staging: o agente prepara e documenta, o Victor executa.
- Inventário de segredos por ambiente (nomes, Victor, 2026-09-28): prod tem os mesmos de staging **menos** `PRIVY_CUSTOM_AUTH_KEY_ID` e `PRIVY_CUSTOM_AUTH_PRIVATE_KEY`; nenhum dos dois tem `STELLAR_PAYOUT_OPERATOR_SECRET`. A tabela completa vai para o `deploy-checklist.md` na task INFRA, com o que falta em prod e quando entra (SUB-003, SUB-004).

## Out of scope

- API keys com hash e rotação (`tasks/prd-api-key-hash/`); contração da coluna `key` (release seguinte, D2); front do backoffice (`task_01m3n1rzb1e06vnb07v64h7xgc`).
- Renomear o perfil `test` para `staging` (SUB-006): só decidir; se for, task própria.
- CORS com DELETE/PUT/PATCH (SEC-002) e 400/404 nas rotas de API key (ADMIN-009): F4.

## Open questions

Decididas em 2026-09-28 (Victor): D4 catálogo global; counter regressivo responde 403 (`ForbiddenError`, o padrão do projeto para "autenticado mas sem direito"); `PRIVY_APP_SECRET` obrigatório só em `production`; staging e prod rodam com ZK real e os artefatos estão versionados no git; `CPF_HMAC_SECRET` de staging não rotaciona, risco aceito.

- O cliente em produção revoga só as próprias credenciais? Mapa de uso (D6). · Victor · antes de RF-001 ir para prod.
