# ZAP PLATFORM — ARCHITECTURE & BUSINESS CONTRACT (existing project)

## 0. Current state and economical agent workflow
1. Zapv3 is an **existing implemented monorepo**, not an empty repository. Never recreate scaffolding or restart the initial milestone unless explicitly requested.
2. `AGENTS.md` is the concise mandatory entrypoint. For normal changes, read only task-relevant source files; consult **specific sections** of this contract only when the requested change touches their rules. Do not read this entire document automatically.
3. Preserve existing working behavior and project boundaries. Make small, testable, reversible changes; avoid full-repo scans, large plans, redundant documentation, unnecessary dependencies, multiple agents and repeated tests.
4. Ask only for missing essential information, credentials, destructive operations or irreversible decisions. Never invent secrets or claim unexecuted tests or deployments.
5. The historical initial build plan below is reference context, **not a standing instruction to execute**. Actual source code and current migrations determine what is already implemented; verify before proposing changes.
6. Keep AI output concise (usually at most five lines), except when more detail is requested or required to explain risk.

## 1. Language and localization
- This contract and agent-facing technical documentation use concise English for consistency; English is NOT inherently more accurate for AI.
- ALL user-facing content MUST use natural Brazilian Portuguese (`pt-BR`): UI labels, menus, forms, validation/errors, notifications, emails, onboarding, help, and accessibility text.
- Use Brazilian logistics terminology: "empresa", "profissional", "coleta", "encomenda", "central", "atendente"; never expose English role codes or raw technical errors in the UI.
- Code identifiers, API routes, SQL names, commits, and agent instructions may remain in English. Set `lang="pt-BR"`, locale-aware dates/numbers, Brazilian phone formatting, and UTF-8; store timestamps in UTC.

## 2. Business scope
7. Pilot: 3 companies and 4 independent delivery professionals; mobile-first dispatch replacing unclear WhatsApp pickup instructions.
8. Three independent operational React apps: platform administration, company operations, professional operations, plus a public React home for the delivery site; later optional privacy-safe read-only TV map (NOT first milestone).
9. A user has ONE account/phone and MULTIPLE roles: `platform_admin`, `company_admin`, `attendant`, `professional`; roles may coexist. Only authorized admins assign elevated roles; self-registration grants professional only.
10. Platform admin (Zap Encomendas) manages all; company admins manage their own company; attendants dispatch/monitor within permission; professionals work independently for multiple authorized companies.
11. Initial registration is frictionless, with no mandatory manual professional approval; company memberships and trusted professional networks still require authorization.
12. Companies save reusable pickup places (coordinates, friendly nickname, notes); all pilot companies share one receiving depot as default destination.
13. Orders specify pickup, shared depot, description, contact, instructions; direct/group offers, accept/reject, status changes, evidence photos, history. Exactly ONE professional may accept an order.
14. Professional GPS sharing is opt-in and active-work scoped; company map only shows authorized available professionals. No public marketplace, finance, passenger rides, AI routing, or complex optimization in MVP.

## 3. Stack and deployment constraints
15. Node.js LTS + TypeScript, npm workspaces; Fastify REST API (`/api/v1`) as a MODULAR MONOLITH, NOT distributed microservices. Realtime only where needed.
16. React + Vite + TypeScript, separate mobile-first `apps/admin-web`, `apps/company-web`, `apps/professional-web` and public `apps/home-web`; shared types/API client and reusable UI only when justified.
17. SQL database hosted at Hostinger; NO Supabase, Firebase Database, Redis, external queue, or application-level cache initially. Backend alone connects to SQL; React never sees SQL credentials.
18. Default to MySQL 8-compatible parameterized SQL and versioned migrations; verify Hostinger actually provides MySQL/MariaDB/PostgreSQL BEFORE choosing driver or running migrations. Document remote access, SSL, firewall, and Node hosting prerequisites; do not assume shared hosting runs Node.
19. Favor indexes, pagination, selective queries, bounded GPS frequency, event-driven updates; avoid unnecessary geocoding/maps calls. Do not disable normal DB/browser internal caches.
20. Use `MapsProvider`, `GeocodingProvider`, `PushProvider`, `StorageProvider` interfaces; configurable adapters, no fake credentials. Store private uploads outside public web roots and SQL only as metadata.
21. Web push/PWA background ringing and GPS may be OS-limited: test on real devices; do NOT promise persistent background behavior. Document native wrapper/app path if required.

### Existing native Android build (verified 2026-11-05)
- Preserve `mobile/android`, its Java Foreground Service and the `motorista` / `transportadora` flavors. Use the Gradle Wrapper through `npm run build:mobile`; the existing sync script preserves `/downloads/encomendaszap-motorista.apk` and `/downloads/encomendaszap-transportadora.apk`.
- This session's toolchain is now installed: Android SDK 35 at `/workspace/android-sdk`, JDK 17 at `/workspace/jdk17`, Gradle cache at `/workspace/gradle-cache`, Android user configuration at `/workspace/android-user/.android`. See `docs/OPERATIONS.md` for the verified command and proxy trust settings. These paths describe this workspace; verify their existence in a new environment before assuming readiness.
- Reuse this toolchain and the native project. Never promise delivery with the phone powered off or after force-stop/process termination. Physical-device checks remain required for background GPS, sound/vibration and Android restrictions.

## 4. Repository layout reference
```text
AGENTS.md                 README.md             .env.example
apps/{home-web,admin-web,company-web,professional-web}/
services/api/src/{modules,infrastructure}/
services/api/src/modules/{identity,companies,professionals,places,locations,orders,notifications,audit}/
packages/{contracts,api-client,ui}/
database/{migrations,seeds}/
docs/{ARCHITECTURE,DOMAIN,DATABASE,API,SECURITY,OPERATIONS,DECISIONS,TASKS}.md
tests/
```
22. Modules own their routes, schemas, services, repositories; avoid giant files, circular imports, cross-module SQL access, duplicated business rules, and shared mutable globals.

## 5. Original SQL/domain contract (historical baseline; verify current migrations)
23. Use stable PKs (MySQL UUID `CHAR(36)` unless documented otherwise), UTC timestamps, explicit FKs/UNIQUE constraints, indexes, and versioned SQL migrations.
24. `users(id,name,phone_e164 UNIQUE,password_hash,status,created_at,updated_at)`; `roles(id,code UNIQUE)`; `permissions(id,code UNIQUE)`; `role_permissions(role_id,permission_id)`.
25. `user_global_roles(user_id,role_id)` (global roles only); `companies(id,name,status)`; `company_members(id,company_id,user_id,role_id,status)` with unique membership scope.
26. `professional_profiles(user_id PK,vehicle_type,availability,location_consent_at)`; `company_professionals(company_id,professional_user_id,status)`.
27. `places(id,company_id NULL,nickname,latitude DECIMAL(10,7),longitude DECIMAL(10,7),notes,created_by)`; `depots(id,place_id,active)`; `company_depots(company_id,depot_id,is_default)`.
28. `professional_locations(professional_user_id PK,latitude,longitude,accuracy_m,recorded_at)` stores latest position only for MVP.
29. `orders(id,company_id,created_by,pickup_place_id,destination_depot_id,description,pickup_contact,notes,status,accepted_by NULL,accepted_at NULL)`.
30. `order_offers(id,order_id,professional_user_id,status,offered_at,responded_at)` unique per order/professional; `order_events(id,order_id,actor_user_id,from_status,to_status,occurred_at,metadata_json)`.
31. `order_attachments(id,order_id,uploaded_by,storage_key,mime_type,size_bytes)`; `device_tokens(id,user_id,platform,token,revoked_at)`; `notifications(id,user_id,order_id,type,status,sent_at)`; `audit_logs(id,actor_user_id,action,entity_type,entity_id,occurred_at,metadata_json)`.
32. Add timestamps/indexes as appropriate; enforce company ownership in service queries, not just UI. No finance tables or secrets in seeds. Dev seeds must be clearly non-production.

## 6. API, security, and workflow
33. Implement typed request/response schemas, standard errors, authorization, filtering/pagination, idempotency and API docs.
34. Auth: `POST /auth/register-professional`, `POST /auth/login`, `GET /me` under `/api/v1`; secure bootstrap command for first platform admin, NEVER public admin signup.
35. Admin: protected users, companies, role assignments and revocations. Company: places, authorized available professionals, orders. Professional: availability, location, offers, accept/reject. Orders: status and evidence uploads.
36. Status transitions: `draft -> open -> accepted -> arrived_pickup -> collected -> delivered`; allow controlled cancellation; record immutable events and authorized actors.
37. Acceptance MUST use atomic SQL transaction/conditional update; test concurrent accept race. Never use in-memory locking as source of truth.
38. Persist notification intent and retry idempotently; push failure must not corrupt order acceptance. Never pretend push is working when unconfigured.
39. Security: Argon2id (or comparable) password hashes, secure expiring/revocable sessions, scoped RBAC, tenant isolation, rate limits, CORS, HTTPS, validated private uploads, no secrets in logs or frontend.
40. LGPD: purpose-limited GPS consent, restricted visibility, minimum retention, auditable privileged actions, deletion/anonymization strategy. No destructive migrations without explicit approval; document backup/restore.

## 7. Original first delivery milestone (historical; do not re-execute)
41. Scaffold workspaces, scripts, TypeScript, lint, tests, `.gitignore`, `.env.example`, docs and runnable Fastify `/health`.
42. Implement initial SQL migrations, local compatible DB workflow, non-production seed, real authentication, role checks, admin-managed companies and `GET /me`.
43. Build minimal REAL login and protected landing pages for the three operational React apps, plus the public home; do not generate dozens of mock screens.
44. After foundation passes: implement saved place -> order -> direct offer -> atomic accept -> status/history as one verified vertical slice.
45. Define GPS/maps/push/storage adapters; implement only what can be configured/tested. If Hostinger is unavailable, run local SQL and document deployment steps; do not claim remote setup succeeded.
46. Tests: role escalation denial, cross-company isolation, order state transitions, concurrent acceptance, auth and API integration. Report exact commands and outcomes.
47. Acceptance: reproducible install/build/test/dev commands; public home, three independent operational apps, one API and versioned SQL; no frontend DB access; no public admin creation; concise next-task list.

## 8. Documentation lifecycle and token economy
48. Contracts are LIVE but STABLE during pre-production. Do NOT update `.md` for routine bug fixes, UI tweaks, or internal refactors that preserve contracts.
49. Update ONLY affected sections when architecture, SQL schema, public API, permissions, business rules, or essential operations actually change; keep `AGENTS.md` links correct.
50. Briefly justify significant changes in `docs/DECISIONS.md`; keep code, migrations, tests and relevant contract synchronized. Never silently change an agreed rule.
51. Before production: review auth/security, SQL migrations, backup/restore, permissions, deployment, observability, compatibility and real-device push/GPS behavior; then enforce stricter versioning.
52. Final response per task: changed files, verified tests, implemented vs stubbed vs blocked, decisions (if any), exact next step. Be concise.

**CURRENT RULE:** Implement only the user's current task in the existing repository. Do not recreate the project, execute old milestones, deploy or delete real data without authorization.
