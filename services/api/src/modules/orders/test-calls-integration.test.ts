import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { MemoryStore } from '../../store.js';
import { sessionToken } from '../../security.js';
import { TestCallsRepository } from './test-calls-repository.js';
import { registerTestCallSocket } from './test-calls-socket.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)('Socket.IO e MySQL integrados', () => {
  const url = new URL(testUrl ?? 'mysql://localhost/zap_test');
  if (!url.pathname.endsWith('_test') || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Banco de teste deve ser local e terminar em _test.');
  const pool = mysql.createPool(testUrl ?? 'mysql://localhost/zap_test');
  const store = new MemoryStore();
  const app = buildApp(store);
  const repository = new TestCallsRepository(pool);
  const sockets: Socket[] = [];
  const company = randomUUID(), otherCompany = randomUUID(), actor = randomUUID(), driver = randomUUID(), outsider = randomUUID();
  const secret = 'segredo-local-de-teste';
  let endpoint = '';
  beforeAll(async () => {
    for (const file of ['002_identity_bootstrap.sql', '003_pickup_test_calls.sql']) {
      const sql = (await readFile(resolve(process.cwd(), '../../database/migrations', file), 'utf8')).replace(/^--.*$/gm, '');
      for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await pool.query(statement);
    }
    for (const id of [actor, driver, outsider]) {
      await pool.execute('INSERT INTO users (id,name,phone_e164,password_hash) VALUES (?,?,?,?)', [id, 'Teste', id.slice(0, 16), 'hash']);
      store.users.set(id, { id, name: 'Teste', phone: id.slice(0, 16), passwordHash: '', roles: id === actor ? [] : ['professional'], companyIds: [], status: 'active' });
    }
    for (const id of [company, otherCompany]) await pool.execute('INSERT INTO companies (id,name) VALUES (?,?)', [id, 'Empresa']);
    await pool.execute("INSERT INTO roles (id,code) VALUES (?,'company_admin') ON DUPLICATE KEY UPDATE code=VALUES(code)", [randomUUID()]);
    await pool.execute("INSERT INTO company_members (id,company_id,user_id,role_id) SELECT ?,?,?,id FROM roles WHERE code='company_admin'", [randomUUID(), company, actor]);
    await pool.execute('INSERT INTO professional_profiles (user_id) VALUES (?),(?)', [driver, outsider]);
    await pool.execute('INSERT INTO company_professionals (company_id,professional_user_id) VALUES (?,?)', [company, driver]);
    registerTestCallSocket(app, store, repository, secret, []);
    endpoint = await app.listen({ port: 0, host: '127.0.0.1' });
  });
  afterAll(async () => { sockets.forEach(socket => socket.disconnect()); await app.close(); await pool.end(); });
  async function connect(user: string) {
    const socket = io(endpoint, { auth: { token: sessionToken(user, secret) }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    return new Promise<Socket>((resolve, reject) => { socket.once('connect', () => resolve(socket)); socket.once('connect_error', reject); });
  }
  it('autoriza, entrega, recupera e aceita uma única vez', async () => {
    const sender = await connect(actor);
    const receiver = await connect(driver);
    const unlinked = await connect(outsider);
    expect((await sender.emitWithAck('company:subscribe', otherCompany)).ok).toBe(false);
    expect((await sender.emitWithAck('company:subscribe', company)).ok).toBe(true);
    expect((await sender.emitWithAck('test-call:create', { companyId: company, professionalId: outsider })).ok).toBe(false);
    const incoming = new Promise(resolve => receiver.once('test-call:updated', resolve));
    const created = await sender.emitWithAck('test-call:create', { companyId: company, professionalId: driver });
    expect(created.ok).toBe(true);
    const id = created.data.id as string;
    expect(Date.parse(created.data.expiresAt) - Date.now()).toBeGreaterThan(25_000);
    await expect(incoming).resolves.toMatchObject({ id });
    expect((await unlinked.emitWithAck('test-call:respond', { id, answer: 'accepted' })).ok).toBe(false);
    receiver.disconnect();
    const restored = await connect(driver);
    expect((await restored.emitWithAck('test-call:pending')).data).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    const answers = await Promise.all([restored.emitWithAck('test-call:respond', { id, answer: 'accepted' }), restored.emitWithAck('test-call:respond', { id, answer: 'rejected' })]);
    expect(answers.filter(answer => answer.ok)).toHaveLength(1);
    const status = await sender.emitWithAck('test-call:status', { id, companyId: company });
    expect(status.ok).toBe(true);
    expect(['accepted', 'rejected']).toContain(status.data.status);
    expect((await sender.emitWithAck('test-call:status', { id, companyId: otherCompany })).ok).toBe(false);
    const [events] = await pool.execute<RowDataPacket[]>('SELECT status FROM pickup_test_call_events WHERE call_id=?', [id]);
    expect(events).toHaveLength(2);
    const dutyStatus = new Promise(resolve => sender.once('professional:status', resolve));
    expect((await restored.emitWithAck('duty:set', true)).ok).toBe(true);
    await expect(dutyStatus).resolves.toMatchObject({ companyId: company, professionalId: driver, onDuty: true, online: true });
    expect((await restored.emitWithAck('location:update', { latitude: -16.68, longitude: -49.25, accuracy: 20 })).ok).toBe(true);
    expect((await restored.emitWithAck('duty:set', false)).ok).toBe(true);
  });
  it('expira uma chamada pendente após o prazo real de 30 segundos', async () => {
    const sender = await connect(actor);
    expect((await sender.emitWithAck('company:subscribe', company)).ok).toBe(true);
    let callId = '';
    const expired = new Promise<{ id: string; status: string }>(resolve => sender.on('test-call:updated', value => { if (value.id === callId && value.status === 'expired') resolve(value); }));
    const start = Date.now();
    const created = await sender.emitWithAck('test-call:create', { companyId: company, professionalId: driver });
    expect(created.ok).toBe(true);
    callId = created.data.id;
    await expect(expired).resolves.toMatchObject({ id: callId, status: 'expired' });
    expect(Date.now() - start).toBeGreaterThanOrEqual(29_000);
    expect(Date.now() - start).toBeLessThan(38_000);
  }, 45_000);
});
