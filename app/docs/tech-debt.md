# Débitos técnicos assumidos — Vesta backend

Registro do que foi **adiado de propósito**, com o gatilho para revisitar. Existe para que ninguém, humano ou agente, "conserte" por engano o que foi decidido deixar assim, e para que o custo de cada adiamento fique visível.

Regras do registro:

- Um débito só entra aqui com decisão registrada em `decisions.md` (§1) e data.
- Cada item tem um **gatilho**: o fato que, quando acontecer, obriga a reabrir.
- As rules do harness (`.cursor/rules/`) citam o id (`TD-001`) onde a regra existe por causa do débito.
- Quando um débito é pago, a linha fica com a data de fechamento e o PR. Não apaga.

| Id     | Data       | O que foi decidido                                                                                                                                                                                                                                                                                                                                      | O que ficou de fora                                                                                                                                                                                                                                                                     | Custo de conviver                                                                                                                                                   | Gatilho para revisitar                                                                                                                              | Fechado em |
| ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TD-001 | 2026-09-24 | Eventos de domínio **em processo** via `EventBus` do `@nestjs/cqrs`: uma saga ou `@EventsHandler` por consumidor, publicados pelo handler depois do commit. Resolve D9 no degrau 2 sem o degrau 1                                                                                                                                                       | **Outbox** (evento gravado na mesma transação e processado por worker com lock e retry) e fila em Redis (BullMQ). Se o processo cair entre o commit e o consumidor, o efeito (comissão, submit on-chain) se perde e depende do `reconcile` ou de reprocesso manual                      | Perda silenciosa de efeito em deploy ou crash; `setInterval` continua sendo o "worker"; duas instâncias podem disputar a mesma linha                                | Qualquer um: segunda instância do ECS em prod; efeito on-chain que não pode ser reprocessado à mão; settlement v2; volume acima de ~100 submits/dia | —          |
| TD-002 | 2026-09-24 | Fronteira de chain **agnóstica no vocabulário, não na infraestrutura**: ports em `domain/` ou `application/` falam em prova, recibo, endereço como string; **um adapter** (Stellar/Soroban) em `infra/gateways/chain/stellar/`; SDK só dentro do adapter, travado por ESLint; rede persistida como dado (`OrganizationWallet.network`), nunca só em env | **Multichain de verdade**: factory que escolhe o adapter pela rede do tenant ou emissor, segundo adapter, contratos equivalentes em outra rede, testes de paridade entre adapters                                                                                                       | Se surgir cliente em outra rede, a factory e o segundo adapter são trabalho novo; o formato dos ports pode ter viés Stellar que só aparece na segunda implementação | Primeiro cliente ou proposta comercial que exija rede diferente da Stellar; ou decisão de produto de oferecer escolha de rede                       | —          |
| TD-003 | 2026-09-24 | Harness cobre só o backend TypeScript nesta rodada                                                                                                                                                                                                                                                                                                      | Rule `standard-contract.mdc` (globs `contracts/**/*.rs`) e skill `contract-change` (mudar contrato → build wasm → testes Rust → deploy testnet → atualizar id e codec TS). Os três contratos (`vesta-verifier`, `vesta-issuer-registry`, `vesta-payout-vault`) seguem sem regra escrita | Mudança de contrato feita por agente sem checklist: risco de quebrar codec TS, esquecer TTL de storage, `require_auth` ou versão                                    | Primeira task da release que toque `contracts/`; ou verifier v2 (D11)                                                                               | —          |

## Distância até o alvo (frentes)

O alvo é o que as rules em `.cursor/rules/` descrevem. Medido em 2026-09-24: `credential` e `proof` estão no formato, `issuer` e `challenge` a poucos arquivos, o resto é legado. As frentes abaixo são o que falta, na ordem em que uma destrava a outra. Cada frente vira uma ou mais tasks no Track quando entrar em release; tocar um módulo por outro motivo segue a regra de "move só o que a task muda", nunca puxa a frente inteira.

### F1 · Harness

- Rules restantes: `standard-code`, `standard-test`, `standard-chain`, `standard-security`.
- Skills: `new-module`, `unit-testing`, `integration-testing`, `chain-gateway`, `prisma-migration`.
- Symlinks em `.claude/rules` e `.claude/skills`; validar o mesmo prompt nos dois agentes.
- Sensor de testes relacionados no `format-on-edit`.
- ESLint `no-restricted-imports` para `@stellar/stellar-sdk` fora de `src/infra/gateways/chain/`, com allowlist dos 6 arquivos atuais que encolhe a cada frente.
- Agent `code-reviewer` com checklist mapeado rule por rule.
- Commands do fluxo spec-driven (`create-prd`, `create-tech-spec`, `create-task`, `exec-task`) e templates.

### F2 · Testes

- Árvore `__tests__/@unit/{entities,value-objects,formatters,builders}`, `@integration/{handlers,services,rules}`, `@e2e/fixtures`, `mocks/{repository,gateway,cqrs,service}`, `helpers/`.
- Um `mockXRepository()` e um `mockXGateway()` por token abstrato.
- Reclassificar os 17 specs atuais: os `*.service.spec.ts` são integração, não unit.
- `test:e2e` funcionando contra a API local com `.env.test`; o smoke atual vira spec `@e2e`.
- Cobertura medida só em `domain/`.

### F3 · Fronteira de chain (TD-002)

- Ports abstratos em `domain/`: verificador de prova, registry de emissor, vault de payout, conta e trustline, assinante.
- `src/infra/gateways/chain/stellar/`: cliente RPC, builder e assinatura de transação, um gateway por contrato, codec XDR isolado.
- Quebrar `modules/stellar/stellar.service.ts` (592 linhas) e `modules/wallet/wallet.service.ts` (608) nesses arquivos; mover os gateways Soroban de `commission` e `issuer` para o adapter.
- Assinante como parâmetro do port (plataforma, operador de payout, organização, usuário futuro); nenhum `Keypair.fromSecret` fora do adapter.
- Remover o "modo mock" do service; teste usa `mocks/gateway/`.
- `issuer-did.value-object.ts` e `scripts/deploy-payout-vault.ts` param de importar o SDK.
- Allowlist do ESLint vai a zero.

### F4 · Módulos ao alvo

- `commission`: 11 arquivos soltos viram `domain/` (entidade de lançamento e de payout, com os enums gêmeos), `application/services/`, `infra/`.
- `issuer` e `challenge`: mover os 3 arquivos soltos de cada.
- `vc` e `zk`: viram gateways ou services de `application/` do módulo dono (`credential` e `proof`).
- Dissolver `modules/backoffice`: `api-keys`, `commissions`, `credentials`, `profile`, `verifications` viram `api/backoffice/` e `application/backoffice/` do módulo dono; `verifiers` vira `modules/verifier`. Rotas não mudam.
- Handlers com mais de quatro dependências (`proof-public-prepare`) movem a orquestração para `application/services/`.

### F5 · Eventos em processo (TD-001)

- Eventos `credential-issued`, `proof-verified`, `commission-accrued`, `credential-revoked` em `domain/events/`.
- Os 3 side effects (attestation → comissão, comissão → vault, saque → settle) viram `@EventsHandler` idempotentes em `application/internal/`.
- `setInterval` dos processors vira `@nestjs/schedule` com lock por linha.
- `IngressLogger` e `EgressLogger` passam a ser chamados (hoje as tabelas estão vazias).

### F6 · CI

- Pedidos em `cloud/ci-pipeline-requests.md`; depende do time de infra.

## Como pagar um débito

1. Abrir task no Track apontando o id.
2. Branch própria (`chore/td-001-outbox`), porque muda arquitetura e precisa ser revertível sozinha.
3. ADR em `docs/adr/` quando estrutural; linha em `decisions.md` §1 sempre.
4. Atualizar a rule que citava o débito e a linha desta tabela.
