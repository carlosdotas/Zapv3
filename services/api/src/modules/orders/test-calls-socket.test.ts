import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { buildApp } from '../../app.js';
import { sessionToken } from '../../security.js';
import type { IdentityStore } from '../../store.js';
import type { User } from '../../domain.js';
import { registerTestCallSocket } from './test-calls-socket.js';
import type { TestCallsRepository } from './test-calls-repository.js';

describe('Socket.IO de chamadas de teste', () => {
  const secret = 'segredo-de-teste-local';
  const company = '11111111-1111-4111-8111-111111111111';
  const driver = '22222222-2222-4222-8222-222222222222';
  const actor = '33333333-3333-4333-8333-333333333333';
  const call = { id: '44444444-4444-4444-8444-444444444444', companyId: company, professionalId: driver, status: 'pending', expiresAt: new Date(Date.now() + 30000).toISOString() };
  const users = new Map<string, User>([
    [driver, { id: driver, name: 'Motorista', phone: '+5562111111111', passwordHash: '', roles: ['professional'], companyIds: [], status: 'active' }],
    [actor, { id: actor, name: 'Empresa', phone: '+5562222222222', passwordHash: '', roles: [], companyIds: [], status: 'active' }],
  ]);
  const store: IdentityStore = { ready: Promise.resolve(), findById: id => users.get(id), findByPhone: () => undefined, createProfessional: async () => { throw new Error('não usado'); } };
  const repo = { companies: vi.fn(async () => [{ id: company, name: 'Empresa' }]), isCompanyMember: vi.fn(async (user: string, id: string) => user === actor && id === company), isProfessionalLinked: vi.fn(async (user: string, id: string) => user === driver && id === company), professionals: vi.fn(async () => [{ id: driver, name: 'Motorista' }]), create: vi.fn(async () => call), pending: vi.fn(async () => [call]), expiredIds: vi.fn(async () => []), respond: vi.fn(async () => null) } as unknown as TestCallsRepository;
  const app = buildApp(store);
  const sockets: Socket[] = [];
  let endpoint = '';
  beforeAll(async () => {
    registerTestCallSocket(app, store, repo, secret, []);
    endpoint = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => { sockets.forEach(socket => socket.disconnect()); await app.close(); });
  function connect(token: string) {
    const socket = io(endpoint, { auth: { token }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    return new Promise<Socket>((resolve, reject) => { socket.once('connect', () => resolve(socket)); socket.once('connect_error', reject); });
  }
  it('recusa conexões sem sessão válida', async () => {
    await expect(connect('inválida')).rejects.toThrow('Sessão inválida');
  });
  it('entrega a chamada somente após autorização e recupera pendentes ao reconectar', async () => {
    const companySocket = await connect(sessionToken(actor, secret));
    const driverSocket = await connect(sessionToken(driver, secret));
    expect((await companySocket.emitWithAck('company:subscribe', company)).ok).toBe(true);
    expect((await driverSocket.emitWithAck('company:subscribe', company)).ok).toBe(false);
    const received = new Promise(resolve => driverSocket.once('test-call:updated', resolve));
    expect((await companySocket.emitWithAck('test-call:create', { companyId: company, professionalId: driver })).ok).toBe(true);
    await expect(received).resolves.toMatchObject({ id: call.id });
    driverSocket.disconnect();
    const reconnected = await connect(sessionToken(driver, secret));
    expect((await reconnected.emitWithAck('test-call:pending')).data).toEqual([call]);
  });
});
