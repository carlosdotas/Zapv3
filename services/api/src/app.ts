import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { MemoryStore, type IdentityStore } from './store.js';
import { verifyPassword, sessionToken, sessionUser } from './security.js';
import { registerFrontendRoutes } from './web.js';

type AuthRequest = FastifyRequest & { userId?: string };
const secret = process.env.SESSION_SECRET ?? 'development-only-change-me-32-characters';
export function buildApp(store: IdentityStore = new MemoryStore()): FastifyInstance {
  const app = Fastify({ logger: false });
  const origins = [...new Set([...(process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) ?? []), 'https://dotas.site', 'https://admin.dotas.site', 'https://empresa.dotas.site', 'https://profissional.dotas.site'])];
  void app.register(cors, { origin: origins });
  let identityAvailable = true;
  app.addHook('onReady', async () => { try { await store.ready; } catch { identityAvailable = false; console.error('Falha ao inicializar o banco de identidade; confira as variáveis e permissões do MySQL.'); } });
  app.addHook('onClose', async () => { await store.close?.(); });
  app.addHook('preHandler', async (request, reply) => { if (request.url.startsWith('/api/v1/') && !identityAvailable) return reply.code(503).send({ error: { code: 'IDENTITY_UNAVAILABLE', message: 'O acesso está temporariamente indisponível. Tente novamente mais tarde.' } }); });
  app.get('/health', async () => ({ status: 'ok', service: 'zap-api' }));
  app.post('/api/v1/auth/register-professional', async (request, reply) => {
    const body = request.body as { name?: string; phone?: string; password?: string };
    if (!body.name || !body.phone || !body.password || body.password.length < 8) return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Informe nome, telefone e uma senha com pelo menos 8 caracteres.' } });
    try { const user = await store.createProfessional(body.name.trim(), body.phone.trim(), body.password); return reply.code(201).send({ user: { id: user.id, name: user.name, roles: user.roles } }); }
    catch (error) { if ((error as Error).message === 'PHONE_EXISTS') return reply.code(409).send({ error: { code: 'PHONE_EXISTS', message: 'Este telefone já está cadastrado.' } }); throw error; }
  });
  app.post('/api/v1/auth/login', async (request, reply) => {
    await store.ready;
    const body = request.body as { phone?: string; password?: string }; const user = body.phone ? await store.findByPhone(body.phone) : undefined;
    if (!user || user.status !== 'active' || !body.password || !(await verifyPassword(body.password, user.passwordHash))) return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Telefone ou senha inválidos.' } });
    return { token: sessionToken(user.id, secret), user: { id: user.id, name: user.name, roles: user.roles } };
  });
  app.addHook('preHandler', async (request: AuthRequest, reply) => { if (!request.url.startsWith('/api/v1') || request.url.startsWith('/api/v1/auth/')) return; const id = sessionUser(request.headers.authorization?.replace(/^Bearer\s+/i, ''), secret); const user = id ? await store.findById(id) : undefined; if (!user || user.status !== 'active') return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sua sessão expirou. Entre novamente.' } }); request.userId = id!; });
  app.get('/api/v1/me', async (request: AuthRequest, reply) => { const user = await store.findById(request.userId!); if (!user) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sessão inválida.' } }); return { user: { id: user.id, name: user.name, phone: user.phone, roles: user.roles } }; });
  app.get('/api/v1/admin/ping', { preHandler: async (request: AuthRequest, reply) => { const user = await store.findById(request.userId!); if (!user?.roles.includes('platform_admin')) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Você não tem permissão para esta área.' } }); } }, async () => ({ ok: true }));
  registerFrontendRoutes(app);
  return app;
}
