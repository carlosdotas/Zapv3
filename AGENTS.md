# Zap Platform

Plataforma de despacho de encomendas. `services/api` contém a API Fastify; `apps/*-web` são os três frontends; `packages` contém contratos, cliente HTTP e UI; `database` contém migrações; `docs` contém contratos.

## Comandos

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev:api
```

## Regras

- Todo texto visível ao usuário deve ser pt-BR.
- A API é a única camada que acessa SQL.
- Não adicionar cadastro público de administrador.
- Toda mudança de schema exige nova migração versionada.

Veja `docs/{ARCHITECTURE,DOMAIN,DATABASE,API,SECURITY,OPERATIONS,DECISIONS,TASKS}.md`.
