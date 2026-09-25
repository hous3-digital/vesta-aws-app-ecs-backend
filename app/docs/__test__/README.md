# Testes

Como decidir o que testar, onde, e com qual procedimento. Esta pasta tem dois documentos; o resto vive no harness, em inglês, para que os agentes leiam a mesma fonte que você.

| Pergunta                                           | Onde está                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Quais camadas existem e o que cada uma pode testar | `AGENTS.md`, seção Testing (a tabela de camadas)                                                     |
| Árvore de pastas, mocks, helpers, convenções       | `.cursor/rules/standard-test.mdc`                                                                    |
| O que precisa estar testado, caso a caso           | `cenarios.md` nesta pasta (72 CTs do QA mais as regras de entidade, com a camada dona e o spec)      |
| Como escrever um spec de cada camada               | `.cursor/skills/unit-testing`, `integration-testing`, `e2e-testing`                                  |
| Rodar                                              | `yarn test:unit`, `yarn test:integration` (Postgres do compose), `yarn test:e2e` (cria `vesta_test`) |

## A única pergunta

**O teste descreve uma regra de negócio?** Sim: entidade ou value object vai para `@unit`; handler ou service com ramificação vai para `@integration`. Não: é wiring, e o `@e2e` da rota já cobre. Um spec que só prova que o repositório foi chamado com os argumentos certos prova que o código foi escrito como foi escrito, não que funciona.

## Bug encontrado por QA ou cliente

O spec nasce vermelho antes da correção, com o id do CT no nome (`CT-VESTA-CRED-003 ...`), e a linha em `cenarios.md` marca `red` com o número da issue. O commit da correção deixa o spec verde.
