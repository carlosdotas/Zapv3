import { Server, type Socket } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import type { IdentityStore } from '../../store.js';
import { sessionUser } from '../../security.js';
import { TestCallsRepository, type TestCall } from './test-calls-repository.js';

type Ack = (result: { ok: boolean; error?: string; data?: unknown }) => void;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerTestCallSocket(app: FastifyInstance, store: IdentityStore, repository: TestCallsRepository, secret: string, origins: string[]) {
  const io = new Server(app.server, { cors: { origin: origins }, maxHttpBufferSize: 16_384 });
  const userRoom = (id: string) => `user:${id}`;
  const companyRoom = (id: string) => `company:${id}`;
  const emitCall = async (call: TestCall) => {
    for (const socket of await io.in(userRoom(call.professionalId)).fetchSockets()) {
      const user = await authenticated(socket);
      if (user?.id === call.professionalId && user.roles.includes('professional') && await repository.isProfessionalLinked(user.id, call.companyId)) socket.emit('test-call:updated', call);
    }
    for (const socket of await io.in(companyRoom(call.companyId)).fetchSockets()) {
      const user = await authenticated(socket);
      if (user && await repository.isCompanyMember(user.id, call.companyId)) socket.emit('test-call:updated', call);
      else await socket.leave(companyRoom(call.companyId));
    }
  };
  const emitDuty = async (professionalId: string) => {
    for (const status of await repository.dutyStatuses(professionalId)) {
      for (const socket of await io.in(companyRoom(status.companyId)).fetchSockets()) {
        const user = await authenticated(socket);
        if (user && await repository.isCompanyMember(user.id, status.companyId)) socket.emit('professional:status', status);
        else await socket.leave(companyRoom(status.companyId));
      }
    }
  };

  async function authenticated(socket: Pick<Socket, 'handshake'>) {
    const id = sessionUser(socket.handshake.auth?.token, secret);
    if (!id) return undefined;
    const user = await store.findById(id);
    return user?.status === 'active' ? user : undefined;
  }

  io.use((socket, next) => { void (async () => { if (store.callsReady) await store.callsReady; const user = await authenticated(socket); if (!user) return next(new Error('Sessão inválida.')); socket.data.userId = user.id; next(); })().catch(() => next(new Error('Chamadas temporariamente indisponíveis.'))); });
  io.on('connection', socket => {
    void socket.join(userRoom(socket.data.userId));
    const serviceRoom = `service:${socket.data.userId}`;
    if (socket.handshake.auth?.kind === 'service') void socket.join(serviceRoom);
    socket.on('disconnect', () => { if (socket.handshake.auth?.kind === 'service') void io.in(serviceRoom).fetchSockets().then(async sockets => { if (!sockets.length) { await repository.setOffline(socket.data.userId); await emitDuty(socket.data.userId); } }).catch(() => app.log.error('Falha ao atualizar conexão do motorista.')); });
    socket.on('companies:list', (ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user) return ack({ ok: false, error: 'Sessão expirada.' }); ack({ ok: true, data: await repository.companies(user.id) }); })().catch(() => ack({ ok: false, error: 'Não foi possível carregar as transportadoras.' })); });
    socket.on('company:subscribe', (companyId: string, ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user || typeof companyId !== 'string' || !idPattern.test(companyId) || !await repository.isCompanyMember(user.id, companyId)) return ack({ ok: false, error: 'Acesso não autorizado.' }); await socket.join(companyRoom(companyId)); ack({ ok: true, data: await repository.professionals(companyId) }); })().catch(() => ack({ ok: false, error: 'Não foi possível carregar os motoristas.' })); });
    socket.on('test-call:create', (input: { companyId?: string; professionalId?: string }, ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user || !input || typeof input.companyId !== 'string' || typeof input.professionalId !== 'string' || !idPattern.test(input.companyId) || !idPattern.test(input.professionalId) || !await repository.isCompanyMember(user.id, input.companyId)) return ack({ ok: false, error: 'Acesso não autorizado.' }); const call = await repository.create(input.companyId, input.professionalId, user.id); if (!call) return ack({ ok: false, error: 'Motorista não autorizado para esta transportadora.' }); ack({ ok: true, data: call }); void emitCall(call).catch(() => app.log.error('Falha ao entregar chamada de teste.')); })().catch(() => ack({ ok: false, error: 'Não foi possível criar a chamada.' })); });
    socket.on('test-call:pending', (ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user?.roles.includes('professional')) return ack({ ok: false, error: 'Acesso não autorizado.' }); ack({ ok: true, data: await repository.pending(user.id) }); })().catch(() => ack({ ok: false, error: 'Não foi possível consultar as chamadas.' })); });
    socket.on('test-call:status', (input: { id?: string; companyId?: string }, ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user || !input || typeof input.id !== 'string' || typeof input.companyId !== 'string' || !idPattern.test(input.id) || !idPattern.test(input.companyId) || !await repository.isCompanyMember(user.id, input.companyId)) return ack({ ok: false, error: 'Acesso não autorizado.' }); const call = await repository.companyCall(input.id, input.companyId); if (!call) return ack({ ok: false, error: 'Chamada não encontrada.' }); ack({ ok: true, data: call }); })().catch(() => ack({ ok: false, error: 'Não foi possível consultar a chamada.' })); });
    socket.on('test-call:respond', (input: { id?: string; answer?: string }, ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user?.roles.includes('professional') || !input || typeof input.id !== 'string' || !idPattern.test(input.id) || (input.answer !== 'accepted' && input.answer !== 'rejected')) return ack({ ok: false, error: 'Resposta inválida.' }); const call = await repository.respond(input.id, user.id, input.answer); if (!call) return ack({ ok: false, error: 'Chamada expirada ou já respondida.' }); ack({ ok: true, data: call }); void emitCall(call).catch(() => app.log.error('Falha ao entregar resposta de chamada.')); })().catch(() => ack({ ok: false, error: 'Não foi possível responder à chamada.' })); });
    socket.on('duty:set', (onDuty: unknown, ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user?.roles.includes('professional') || typeof onDuty !== 'boolean') return ack({ ok: false, error: 'Acesso não autorizado.' }); await repository.setDuty(user.id, onDuty); ack({ ok: true }); void emitDuty(user.id).catch(() => app.log.error('Falha ao atualizar estado do motorista.')); })().catch(() => ack({ ok: false, error: 'Não foi possível atualizar o serviço.' })); });
    let lastLocationAt = 0;
    socket.on('location:update', (input: { latitude?: unknown; longitude?: unknown; accuracy?: unknown }, ack: Ack) => { if (typeof ack !== 'function') return; void (async () => { const user = await authenticated(socket); if (!user?.roles.includes('professional') || !input || typeof input.latitude !== 'number' || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || typeof input.longitude !== 'number' || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180 || typeof input.accuracy !== 'number' || !Number.isFinite(input.accuracy) || input.accuracy < 0 || input.accuracy > 999999 || Date.now() - lastLocationAt < 10000) return ack({ ok: false, error: 'Localização inválida ou enviada com muita frequência.' }); lastLocationAt = Date.now(); const saved = await repository.recordLocation(user.id, input.latitude, input.longitude, input.accuracy); if (!saved) return ack({ ok: false, error: 'Entre em serviço para compartilhar a localização.' }); ack({ ok: true }); })().catch(() => ack({ ok: false, error: 'Não foi possível atualizar a localização.' })); });
  });
  let callsAvailable = !store.callsReady;
  if (store.callsReady) void store.callsReady.then(() => { callsAvailable = true; }).catch(() => { console.error('Falha ao inicializar as chamadas; confira as tabelas e permissões do MySQL.'); });
  const expiration = setInterval(() => { if (!callsAvailable) return; void repository.expiredIds().then(async ids => { for (const id of ids) { const call = await repository.expire(id); if (call) await emitCall(call); } }).catch(() => app.log.error('Falha ao expirar chamadas de teste.')); }, 1000);
  expiration.unref();
  app.addHook('onClose', async () => { clearInterval(expiration); await io.close(); });
}
