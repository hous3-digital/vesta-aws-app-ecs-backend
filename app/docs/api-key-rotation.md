# Rotação de API key: o que muda para o cliente em produção

Referência: `tasks/prd-api-key-hash/` (RF-005), `app/docs/decisions.md` (2026-09-28), `app/docs/deploy-checklist.md` (SUB-011).

## Nesta release (R4)

Nada muda para quem usa a API. A key atual continua autenticando com o mesmo header (`X-Api-Key` ou `Authorization: Bearer`) e o mesmo valor. O que mudou está do lado da Vesta: a key deixa de existir em claro no banco (guardamos só o hash e um prefixo de exibição) e os erros de autenticação passam a trazer um `code` estável no corpo do 401:

| `code`            | Significado                                             | O que fazer                                  |
| ----------------- | ------------------------------------------------------- | -------------------------------------------- |
| `API_KEY_MISSING` | Nenhum header com a key                                 | Enviar `X-Api-Key`                           |
| `API_KEY_INVALID` | Key desconhecida ou revogada                            | Conferir a key; se foi revogada, gerar outra |
| `API_KEY_EXPIRED` | Key antiga de uma rotação, passados os 30 dias de prazo | Trocar pela key nova recebida na rotação     |

A rotação já está disponível para quem quiser usar: `POST /backoffice/api-keys/:id/rotate` (pelo backoffice, com o usuário do issuer) ou pela Vesta via admin. Ela devolve a key nova **uma única vez** e mantém a antiga funcionando por 30 dias, para trocar em produção sem janela de indisponibilidade. A listagem mostra `keyPrefix` (os 19 primeiros caracteres) e `expiresAt` de cada key.

## Release seguinte (contração, depende da D2)

A Vesta vai pedir a rotação da key atual com data. Motivo: a key criada antes desta release ainda tem o valor em claro numa coluna que só é removida quando toda key ativa tiver sido gerada já no modelo novo. Texto sugerido para o aviso, canal a definir na D2:

> A partir de DD/MM vamos remover do nosso banco qualquer resquício das API keys antigas. Para isso vamos rotacionar a sua key: você recebe uma key nova por canal seguro e a atual continua funcionando por 30 dias, para trocar no seu backend sem parar o serviço. Se a key antiga expirar antes da troca, a API responde 401 com `code: API_KEY_EXPIRED`.

Antes de mandar o aviso:

- Hoje o painel do backoffice ("Developers", botão "Gerar nova chave") só **cria** uma key (`POST /backoffice/api-keys`): a antiga fica sem prazo e nunca expira. O botão de rotação, que chama `POST /backoffice/api-keys/:id/rotate` e mostra `keyPrefix` e `expiresAt`, é a task do repo `vesta-aws-app-front-backoffice` (PRD RF-010). Enquanto ela não sobe, a rotação do cliente é feita pela Vesta pelo admin (`POST /admin/api-keys/:id/rotate`), e o texto acima já está escrito para esse caminho.
- Confirmar pela D6 se o cliente tem usuário de backoffice; com o botão no ar, o texto pode passar a pedir que ele mesmo rotacione.
- A key nova nunca vai por e-mail em claro.
