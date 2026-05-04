# Módulos

Padrão de estrutura de módulos e referências. Use o módulo **User** como base para novos módulos de domínio.

## Estrutura de pastas

```
modules/[nome]/
├── api/                         # Contratos HTTP
│   ├── public/                  # Endpoints públicos
│   ├── backoffice/              # Endpoints admin/backoffice
│   └── common/                  # DTOs, decorators, outputs compartilhados
├── application/                 # Orquestração (handlers, sagas)
│   ├── public/                  # Fluxos iniciados por usuário via API pública
│   ├── backoffice/              # Fluxos iniciados por admin
│   └── internal/                # Fluxos disparados por eventos (handlers que reagem a eventos)
├── domain/                      # Regras de negócio
│   ├── events/                  # Eventos de domínio
│   └── *.entity.ts              # Entidades
│   └── *.repository.ts          # Interface do repositório
└── infra/                       # Implementações
    ├── *.mapper.ts              # Mapeamento domain ↔ persistence
    ├── *.repository.ts          # Implementação do repositório
    └── *.data-access-object.ts  # DAO (queries)
```

## Descrição das pastas

### api/

**Responsabilidade:** Contratos HTTP — controllers, inputs, params, outputs.

**Guia detalhado:** [Padrão de controllers (API HTTP)](api.md)

- **public:** Endpoints expostos a clientes (apps, frontends)
- **backoffice:** Endpoints administrativos
- **common:** DTOs reutilizados, decorators, formatos de output

Controllers recebem requests, constroem Commands e delegam ao CommandBus. Não contêm lógica de negócio.

### application/

**Responsabilidade:** Orquestração — handlers de command, sagas (reação a eventos).

**Guia detalhado:** [Camada de aplicação](application.md)

- **public:** Handlers para fluxos iniciados pela API pública
- **backoffice:** Handlers para fluxos administrativos
- **internal:** Handlers que **reagem a eventos** — disparados por Sagas quando um evento é publicado. Usados para integração entre módulos sem acoplamento direto.

Handlers recebem Commands, orquestram repositórios/serviços/entidades e retornam (ou publicam eventos).

### domain/

**Responsabilidade:** Regras de negócio puras — entidades, value objects, interfaces de repositório, eventos de domínio.

**Guia detalhado:** [Camada de domínio](domain.md)

- Sem dependência de NestJS, Prisma ou qualquer infraestrutura
- Entidades protegem invariantes
- Repositórios são **interfaces** — implementação fica em `infra`

### infra/

**Responsabilidade:** Implementações técnicas — repositórios, mappers, DAPs.

**Guia detalhado:** [Camada `infra/`](infra.md)

- **Repository:** Implementa a interface do domain, usa Prisma
- **Mapper:** Converte entre modelo de persistência e entidade de domínio
- **DAO (Data Access Object):** Queries para leitura (listagens, relatórios) — não retornam entidades de domínio

---

## Padrão User (referência completa)

O módulo **User** é o mais completo e serve de base:

- API pública e backoffice
- Handlers públicos e backoffice
- Handlers e sagas **internal** (reagem a eventos externos)
- Domain com entidade, repositório, eventos
- Infra com repositório e mapper

**Fluxo típico:** Controller → Command → Handler → Domain (entidade + repositório) → EventBus (opcional)
