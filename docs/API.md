# API

Prefixo `/api/v1`. Erros seguem `{ error: { code, message, details? } }`. Rotas: `POST /auth/register-professional`, `POST /auth/login`, `GET /me`; `GET /health` é público.

Socket.IO usa o mesmo servidor e autentica com `auth.token` da sessão. Os eventos `companies:list`, `company:subscribe`, `test-call:create`, `test-call:status`, `test-call:pending`, `test-call:respond`, `duty:set` e `location:update` respondem via callback `{ ok, data?, error? }`. O servidor emite `test-call:updated` e `professional:status` apenas aos destinatários autorizados. Chamadas de teste expiram 30 segundos após sua criação no banco e não criam pedidos. A localização requer motorista autenticado e serviço ativo; a frequência é limitada a uma atualização a cada 10 segundos por conexão.
