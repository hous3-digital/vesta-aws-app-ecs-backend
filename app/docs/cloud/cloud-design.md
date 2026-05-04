# Padrão de Infraestrutura e CI/CD Integrado

Este projeto foi concebido seguindo os mandamentos arquiteturais de Serviços Isolados com IaC Co-localizado. Em tese, isso garante independência operacional por permitir que o software construído seja orquestrado simultaneamente em proximidade total de suas configurações AWS exclusivas.

- ./app: Contém o coração funcional lógico do aplicativo, testes transacionais de domínio e validação (O node.js, nest.ts core base etc).

- ./infra: Contém todo estado base operatório, descritivos nativos no formato Terraform com foco puro em implantações automatizadas da Nuvem AWS como ECS, Bancos Isolados, OIDC e Rotas de Segurança no Load Balancer e API.

- ./.github: Contém os Shared Workflows GitHub Actions, que são os guardiões do processo de desenvolvimento, garantindo qualidade e segurança desde o código até a implantação.

Como operar o fluxo automatizado: Ao codar, os [Shared Workflows GitHub Actions] farão lintings anti-falhas e analisarão métricas de segurança bloqueando vazamentos usando SonarQube nos PR's direcionados à homologação (staging). Concluindo isso via OIDC (Role Access via Cloud Native Sem Senhas HardCoded) eles migrarão todo o status provisionado para nuvem recriando a sua arquitetura base do Terraform (/infra) instantâneamente seguida das imagens otimizadas do código recém desenvolvido do NodeJS (/app) efetuando Blue-Green Deployments de zero queda em tempo de execução.
