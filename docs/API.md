# API

Prefixo `/api/v1`. Erros seguem `{ error: { code, message, details? } }`. Rotas: `POST /auth/register-professional`, `POST /auth/login`, `GET /me`; `GET /health` é público.

## Pickup test calls (Socket.IO)

The API process hosts Socket.IO at `/socket.io`, authenticating the existing expiring session via `auth.token`. Each action revalidates the active account and relevant role/membership. Platform administrators can access active companies; other company users are restricted to active memberships. Delivery and synchronization to a professional require an active company link and professional role. Acknowledgements use `{data}` or a pt-BR `{error}`. Browser origins must be in `CORS_ORIGINS`; native connections may omit Origin. Clients reconnect with backoff and call `pickup:sync` after every connection; no transport recovery bypasses authentication.

- `company:list {}`: active company memberships with `company_admin`/`attendant` role.
- `pickup:setup-self-test {}`: an active `platform_admin` who also has a professional profile may explicitly create or reuse a dedicated test company linked only to their own account; returns `{companyId,professionalId,phone}`. This action does not create an order or modify an existing company.
- `professional:list {companyId}`: active authorized professionals with lease-based online status.
- `pickup:create {companyId,professionalId}`: online target in the company's network; SQL generates the 2-minute deadline. At most one test per professional per 30 seconds. No operational orders are written.
- `pickup:respond {id,answer:accepted|rejected}`: targeted professional only; transaction locks the request, checks the SQL deadline, updates status and inserts history once. Retries return the recorded result.
- `pickup:updated`: current call `{id,companyId,professionalId,status,expiresAt}` to currently authorized connected users.
- `pickup:sync {}`: latest 100 authorized calls from the preceding day; expired pending records cannot be accepted even before the expiry worker processes them.
- `duty:set {onDuty:boolean}`: professional role, opt-in location consent; `presence:heartbeat {}` every 30 seconds. Presence becomes unavailable after 90 seconds without heartbeat. A transport disconnect does not revoke work consent.
- `location:update {latitude,longitude,accuracy,recordedAt}`: professional role; finite coordinates, valid ranges, accuracy 0–1000 m, timestamp within two minutes, at most one update per four seconds. SQL only saves newer coordinates while on duty. No coordinates are emitted publicly.

The expiry worker processes at most 200 expired requests per second, including requests left pending after a restart. SQL status history is in `pickup_test_events`.
