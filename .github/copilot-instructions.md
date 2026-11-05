# GitHub Copilot — Zapv3

Read `AGENTS.md` first. This is an **existing** platform, not a new scaffold. Do **not** automatically load the full `Zap_Platform_Codex_Prompt.md`; consult only relevant sections for architectural, security, database, Android or business-contract changes.

Work on the smallest relevant file set, preserve the Fastify API, independent React/Vite apps, MySQL migrations, native Android, RBAC, tenant isolation and pt-BR UI. Keep SQL behind the API. Avoid unrelated refactors, unnecessary dependencies, agents, documentation, full-repo scans and redundant tests. Validate the affected scope and report briefly. Never perform destructive production operations without explicit authorization.
