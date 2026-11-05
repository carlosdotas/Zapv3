# AI Agent Instructions

This repository follows the authoritative architecture contract in [`Zap_Platform_Codex_Prompt.md`](Zap_Platform_Codex_Prompt.md). Read this file and the contract before planning or modifying code; do not assume a `CONTRATO.md` file exists.

## Project map

- `services/api`: Node.js LTS, TypeScript and Fastify modular monolith (`/api/v1`).
- `apps/home-web`: public React/Vite/TypeScript delivery landing page.
- `apps/admin-web`, `apps/company-web`, `apps/professional-web`: independent React/Vite/TypeScript operational applications.
- `packages`: shared contracts, API client and UI primitives.
- `database/migrations`, `database/seeds`: versioned Hostinger-compatible MySQL/MariaDB SQL.
- `docs`: architecture, domain, database, API, security, operations, decisions and tasks.

## Mandatory workflow

1. Identify only the task-relevant modules and files after reading this entry point and the authoritative contract.
2. Preserve module boundaries, SQL migrations, API contracts, RBAC roles (`platform_admin`, `company_admin`, `attendant`, `professional`) and tenant isolation.
3. Keep the backend modular, React apps independent, and frontend access to SQL forbidden.
4. Do not add frameworks, dependencies, services, caches or large files without justification and approval.
5. Keep every user-facing label, error, notification and accessibility string in Brazilian Portuguese (`pt-BR`).
6. Make minimal, scoped changes; do not duplicate business logic or alter application behavior unrelated to the task.
7. Run relevant checks and tests, and update architecture documentation only when structural or business contracts materially change.
8. Never modify production data or execute destructive migrations without explicit authorization.
9. Report changed files, exact checks/tests, pending issues and any unconfigured integration honestly.

## AI tool loading

- Cursor: load `.cursor/rules/zap-architecture.mdc`.
- GitHub Copilot: load `.github/copilot-instructions.md`.
- Other agents/tools: explicitly load `AGENTS.md` and then `Zap_Platform_Codex_Prompt.md`; do not assume tools discover either file automatically.

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev:api
```

Priority: maintain architectural consistency, minimize AI token usage, preserve existing functionality and resource efficiency.
