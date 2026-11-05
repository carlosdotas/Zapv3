import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { MemoryStore } from './store.js';
import { verifyPassword, sessionToken, sessionUser } from './security.js';
import type { Role } from './domain.js';
import { registerFrontendRoutes } from './web.js';

type AuthRequest = FastifyRequest & { userId?: string };
const secret = process.env.SESSION_SECRET ?? 'development-only-change-me-32-characters';
export function buildApp(store = new MemoryStore()): FastifyInstance {
  const app = Fastify({ logger: false });
  void app.register(cors, { origin: process.env.CORS_ORIGINS?.split(',') ?? true });
  app.get('/health', async () => ({ status: 'ok', service: 'zap-api' }));
  app.post('/api/v1/auth/register-professional', async (request, reply) => {
    const body = request.body as { name?: string; phone?: string; password?: string };
    if (!body.name || !body.phone || !body.password || body.password.length < 8) return reply.code(400).send({ error: { code: 'INVALID_INPUT', message: 'Informe nome, telefone e uma senha com pelo menos 8 caracteres.' } });
    try { const user = await store.createProfessional(body.name.trim(), body.phone.trim(), body.password); return reply.code(201).send({ user: { id: user.id, name: user.name, roles: user.roles } }); }
    catch (error) { if ((error as Error).message === 'PHONE_EXISTS') return reply.code(409).send({ error: { code: 'PHONE_EXISTS', message: 'Este telefone já está cadastrado.' } }); throw error; }
  });
  app.post('/api/v1/auth/login', async (request, reply) => {
    await store.ready;
    const body = request.body as { phone?: string; password?: string }; const user = body.phone ? store.findByPhone(body.phone) : undefined;
    if (!user || user.status !== 'active' || !body.password || !(await verifyPassword(body.password, user.passwordHash))) return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Telefone ou senha inválidos.' } });
    return { token: sessionToken(user.id, secret), user: { id: user.id, name: user.name, roles: user.roles } };
  });
  app.addHook('preHandler', async (request: AuthRequest, reply) => { if (!request.url.startsWith('/api/v1') || request.url.startsWith('/api/v1/auth/')) return; const id = sessionUser(request.headers.authorization?.replace(/^Bearer\s+/i, ''), secret); if (!id || !store.findById(id)) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sua sessão expirou. Entre novamente.' } }); request.userId = id; });
  app.get('/api/v1/me', async (request: AuthRequest, reply) => { const user = store.findById(request.userId!); if (!user) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sessão inválida.' } }); return { user: { id: user.id, name: user.name, phone: user.phone, roles: user.roles } }; });
  app.get('/api/v1/admin/ping', { preHandler: async (request: AuthRequest, reply) => { const user = store.findById(request.userId!); if (!user?.roles.includes('platform_admin')) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Você não tem permissão para esta área.' } }); } }, async () => ({ ok: true }));
  registerFrontendRoutes(app);
  return app;
}
