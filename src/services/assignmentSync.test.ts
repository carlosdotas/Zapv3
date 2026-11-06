import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RealtimeAssignmentService } from './realtimeAssignmentService';

test('consultas simultâneas compartilham a requisição e invalidação solicita uma leitura posterior', async t => {
  const pending: Array<(response: Response) => void> = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', () => new Promise<Response>(resolve => pending.push(resolve)));
  const service = new RealtimeAssignmentService();
  assert.equal(fetchMock.mock.callCount(), 0);
  const first = service.fetchServerAssignments();
  assert.equal(service.fetchServerAssignments(), first);
  const fresh = service.fetchServerAssignments({ fresh: true });
  pending.shift()!(new Response(JSON.stringify({ success: true, data: {} })));
  await first;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fetchMock.mock.callCount(), 2);
  pending.shift()!(new Response(JSON.stringify({ success: true, data: { '701_coleta': { driverId: '7' } } })));
  assert.equal((await fresh)['701_coleta'].driverId, '7');
});

test('logout invalida resultados anteriores e impede consulta enfileirada da sessão antiga', async t => {
  let resolve!: (response: Response) => void;
  const fetchMock = t.mock.method(globalThis, 'fetch', () => new Promise<Response>(done => { resolve = done; }));
  const service = new RealtimeAssignmentService();
  const old = service.fetchServerAssignments();
  const queued = service.fetchServerAssignments({ fresh: true });
  service.clear();
  resolve(new Response(JSON.stringify({ success: true, data: { old: { driverId: '7' } } })));
  assert.deepEqual(await old, {});
  assert.deepEqual(await queued, {});
  assert.deepEqual(service.getAllAssignments(), {});
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('consulta periódica tem dono explícito e para após a última liberação', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: true, data: {} })));
  const service = new RealtimeAssignmentService();
  const one = service.start();
  const two = service.start();
  await service.fetchServerAssignments();
  assert.equal(fetchMock.mock.callCount(), 1);
  one(); one();
  t.mock.timers.tick(10000);
  await service.fetchServerAssignments();
  assert.equal(fetchMock.mock.callCount(), 2);
  two();
  t.mock.timers.tick(30000);
  assert.equal(fetchMock.mock.callCount(), 2);
});
