# PRD: API keys com hash, prefixo visível e rotação com prazo

Track feature: `feature_01m37qasbne4fr7pfvhhkpbk9z` (release `release_01m1feb76ye8mvg4vseke2b7s3`, R4). Task: `task_01m37yf3j4esj953630bp08rby` (SEC-004 #357). Cobre o RF-002 da feature (F3-002).

## Problem

Toda API key de issuer é guardada em claro em `api_keys.key` e o guard autentica por igualdade nessa coluna (TD-005). Quem lê o banco, um backup ou um dump lê a credencial que dá acesso ao `/public/*` de cada issuer, inclusive a do cliente em produção. A auditoria (S-01, S-05) e a regression run de QA (#357) apontaram isso como o achado mais crítico, e o Victor se comprometeu com a correção na reunião de 25/09. O guard ainda loga um trecho da key rejeitada e os dois controllers de key aceitam body sem DTO, fora do `ValidationPipe`.

## Goals

- Zero API keys em claro no banco de staging e prod ao fim da release seguinte (passo de contração).
- A key do cliente em produção continua autenticando nesta release sem nenhuma ação dele.
- O issuer consegue identificar cada key na lista e trocá-la sem janela de indisponibilidade.
- Nenhum log contém qualquer parte de uma key.

## Users and stories

- Como issuer técnico, quero criar uma key, vê-la uma única vez e reconhecê-la depois pelo prefixo, para configurar meu backend sem que a Vesta guarde meu segredo.
- Como issuer técnico, quero gerar uma key nova mantendo a antiga por um prazo, para trocar em produção sem parar meu serviço.
- Como operador Vesta, quero fazer o mesmo pelo admin em nome de um issuer, para conduzir a rotação do cliente que não usa o backoffice.
- Como integrador, quero um erro com código estável quando a key expirou, para saber que preciso gerar outra e não que digitei errado.

## Functional requirements

- **RF-001** A key é gerada com 24 bytes de `crypto.randomBytes` no formato `vesta_live_<48 hex>`, devolvida inteira apenas na resposta de criação e nunca mais lida de nenhuma rota.
- **RF-002** O banco guarda `SHA-256(key)` em `key_hash` e os 8 primeiros hex do segredo em `key_prefix` (`vesta_live_a1b2c3d4`); a coluna `key` não é mais escrita por keys novas.
- **RF-003** A migration calcula `key_hash` e `key_prefix` de todas as linhas existentes em SQL, idempotente; uma key criada antes desta release autentica igual depois dela.
- **RF-004** O guard resolve a key pelo hash, compara com `timingSafeEqual`, e aceita só key ativa e não expirada.
- **RF-005** `POST /admin/api-keys/:id/rotate` e `POST /backoffice/api-keys/:id/rotate` criam uma key nova para o mesmo issuer e nome, devolvem-na inteira uma vez e marcam `expires_at` = agora + 30 dias na antiga; as duas autenticam até lá. O backoffice só rotaciona key do issuer logado.
- **RF-006** A listagem (admin e backoffice) devolve `keyPrefix` e `expiresAt` por key e nunca a key.
- **RF-007** Falhas de autenticação por key devolvem 401 com código estável no corpo do filtro de erro: `API_KEY_MISSING`, `API_KEY_INVALID`, `API_KEY_EXPIRED`, o último com mensagem orientando a gerar uma key nova.
- **RF-008** Nenhum log contém trecho de key; tentativa inválida loga só o evento, criação e revogação logam id e issuer.
- **RF-009** Os bodies de criação nos dois controllers são DTOs `class-validator`; campo faltando ou extra responde 400, não 401.
- **RF-010** O backoffice web (repo `vesta-aws-app-front-backoffice`) mostra o prefixo e a expiração na lista e oferece "gerar nova key" com o aviso de que a antiga expira em 30 dias. Task própria naquele repo, mesma feature, criada quando o backend concluir (decisão de 2026-09-28).

## Change class

| Rota ou método | Classe | Observação |
| --- | --- | --- |
| `GET /public/*` com `X-Api-Key` | Aditiva | mesmo header, mesma key; 401 ganha `code` no corpo |
| `POST /admin/api-keys`, `POST /backoffice/api-keys` | Comportamental | campo extra passa de aceito a 400; erro de validação de 401 para 400. Front verificado: envia só `{ name }` (SUB-012) |
| `GET /admin/api-keys`, `GET /backoffice/api-keys` | Aditiva | campos `keyPrefix`, `expiresAt` |
| `POST .../api-keys/:id/rotate` | Aditiva | rota nova |
| Esquema `api_keys` | Expansão | colunas novas nulas, backfill; nada é removido nesta release |

Nada no `/public/*` muda de contrato. A quebra (exigir rotação e apagar `key`) fica para a release de contração e depende da D2.

## Constraints

- Migration compatível com a versão que está rodando (skill `prisma-migration`): expansão agora, contração depois. Prod não tem job de migration: linha no `deploy-checklist.md` com o passo manual (SUB-011).
- Cliente em produção não pode precisar de ação nesta release (`decisions.md`, 2026-09-18).
- Segredo nunca em log, fixture, spec ou commit (`AGENTS.md`, rule 5 e `standard-security`). Fixtures locais e de teste passam a inserir hash e prefixo.
- Hash sem salt e sem algoritmo lento é deliberado: o segredo tem 192 bits aleatórios e o lookup precisa de índice. Registrar no `decisions.md`.

## Out of scope

- Apagar a coluna `key` e forçar a rotação com data: release seguinte, task de contração a criar no Track ao concluir esta. Depende da D2 (ADR-000).
- `AdminSecretGuard` com `!==` (TD-006) e JWT sem fallback: task "Segredos obrigatórios em produção".
- Códigos 400/404 nas demais respostas dessas rotas (#359): fora, exceto onde o DTO já muda.
- Rotação dos segredos de staging expostos: task própria, parked.
- Escopo de keys por permissão ou por rota: não existe hoje e não entra.

## Open questions

Decididas em 2026-09-28 (Victor): prazo de convivência de 30 dias; a rotação ideal é o próprio issuer pelo backoffice, a rota de admin é o plano B para a Vesta conduzir; o front entra logo após o backend, como task própria.

- O cliente em produção tem usuário de backoffice? Não é verificável no código: é uma linha em prod, coberta pela task "mapa de uso" (D6). Define se a Vesta conduz a rotação dele pelo admin. · Victor · antes de subir para prod.
- D2 (ADR-000): como avisar e por quanto tempo depreciar. Bloqueia só a contração. · Victor, após D6 · antes da release seguinte.
