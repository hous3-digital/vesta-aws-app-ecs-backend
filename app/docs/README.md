# Documentação

Esta pasta reúne guias de arquitetura, convenções e padrões do backend da Vesta. A ideia é registrar o **porquê** das decisões e o **como** alinhar código novo ao restante do projeto.

Os textos estão **organizados por tema** — alguns ficam na raiz de `docs/`, outros em subpastas. Onde existir subpasta, costuma haver um **README** que explica o assunto e aponta para os guias mais detalhados dessa área.

Para navegar, **abra a pasta ou o arquivo** que corresponda ao que está a implementar e siga as indicações do README ou do guia principal dessa área.

## Na raiz desta pasta

| Arquivo               | O que é                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `architecture.md`     | Princípios (DDD pragmático, CQRS) e a estrutura alvo de módulo                                  |
| `decisions.md`        | Registro vivo de decisões e pendências, com data                                                |
| `tech-debt.md`        | Débitos técnicos com gatilho de pagamento e as frentes até o alvo                               |
| `deploy-checklist.md` | Tudo que precisa ser feito fora do repo ao subir para staging ou produção, e o que trazer de lá |
| `__test__/`           | Estratégia de testes e o catálogo de cenários                                                   |
