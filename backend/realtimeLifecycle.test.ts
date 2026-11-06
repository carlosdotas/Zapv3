import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import type { Express } from 'express';
import type { WebSocketServer } from 'ws';

test('encerramento do tempo real remove listeners e cancela autenticação pendente', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const globals = globalThis as unknown as { prisma?: unknown };
  const before = globals.prisma;
  globals.prisma = { assignments: { findMany: async () => [] } };
  try {
    const { registerRealtime } = await import('./realtime');
    const server = Object.assign(new EventEmitter(), { clients: new Set() });
    const app = { get() {}, post() {}, all() {} };
    const runtime = await registerRealtime(app as unknown as Express, server as unknown as WebSocketServer);
    let closed = 0;
    const socket = Object.assign(new EventEmitter(), { readyState: 1, close: () => { closed++; }, send() {} });
    server.emit('connection', socket);
    assert.equal(server.listenerCount('connection'), 1);
    runtime.dispose(); runtime.dispose();
    assert.equal(server.listenerCount('connection'), 0);
    assert.equal(server.listenerCount('close'), 0);
    t.mock.timers.tick(60000);
    assert.equal(closed, 0);
  } finally {
    if (before === undefined) delete globals.prisma;
    else globals.prisma = before;
  }
});
