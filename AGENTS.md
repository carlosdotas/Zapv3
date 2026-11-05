# Zapv3 — AI Agent Instructions

This is an **existing, working monorepo**, not a greenfield project. Preserve functioning behavior. **Token economy is the default**; never skip essential security or validation.

## Task-first workflow (mandatory)
1. Read this short entrypoint. Determine the requested change and its smallest file scope.
2. Inspect only affected files and their immediate imports, types and tests. Use targeted search; do not recursively dump the repository or read entire docs by default.
3. Read **only relevant sections** of [the architecture/business contract](Zap_Platform_Codex_Prompt.md) or `docs/` when a task changes architecture, database, API, roles, privacy, native lifecycle, deployment, or business behavior. For routine UI/bug fixes, do not load the full contract.
4. Make the smallest safe patch. No unrelated refactoring, speculative features, duplicate logic, additional frameworks, agents or dependencies without need.
5. Run targeted checks first. Expand to cross-workspace/full tests only if affected dependencies, risk or failures justify them. Do not rerun unchanged checks without reason.
6. Do not update markdown for routine fixes. Update only relevant contract/docs sections for material architectural or operational changes.
7. Report briefly: files changed, checks actually run, blockers, next step. Prefer **5 lines or fewer**, unless details are requested or needed for safety.

## Repository map
- `apps/home-web`: public React/Vite frontend.
- `apps/admin-web`: platform administration.
- `apps/company-web`: company dispatch frontend.
- `apps/professional-web`: professional/driver frontend, pickup calls and GPS display.
- `services/api`: Fastify/TypeScript modular API, Socket.IO; SQL access only here.
- `packages/{contracts,api-client,ui}`: shared types, client and UI.
- `database/migrations`: versioned MySQL/MariaDB SQL.
- `mobile/android`: existing Java Android application with `motorista` and `transportadora` flavors.
- `docs/`: architecture, API, domain, security, operations and decisions.

## Non-negotiable invariants
- Preserve module boundaries, typed API contracts, RBAC (`platform_admin`, `company_admin`, `attendant`, `professional`), tenant isolation and secure sessions.
- Never expose SQL credentials to frontends; no destructive production changes or deployment without explicit authorization.
- Keep all user-facing strings in Brazilian Portuguese (`pt-BR`).
- Preserve native foreground GPS, consent, Socket.IO pickup calls, permissions and existing APK build pipeline when changing driver UI.
- Never claim checks, builds or deployments that were not executed.
- Avoid unnecessary dependencies, network traffic, polling and hosting/AI costs; do not compromise correctness to save tokens.

## Targeted commands
- Driver frontend: `npm run typecheck --workspace=@zap/professional-web`; `npm run test --workspace=@zap/professional-web`; `npm run build:professional`.
- Company frontend: `npm run typecheck --workspace=@zap/company-web`; `npm run build:company`.
- API: `npm run test --workspace=@zap/api`; `npm run build:api`.
- Full checks **only when warranted**: `npm run typecheck`, `npm test`, `npm run build`.
- Android changes only: consult `docs/OPERATIONS.md`, then `npm run build:mobile` when toolchain is available.

## Tool-specific rules
Cursor and Copilot instructions must defer to this file; they must not force a full contract reread. Do not spawn parallel AI agents for small tasks.
