import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Express, Request, Response } from 'express';
import { parseRawJsonBody } from './http/parseRawJsonBody';

test('notificações preservam sessão, IDs e aliases com corpo Buffer ou objeto', async () => {
  const calls: unknown[] = [];
  const db = {
    user_sessions: {
      findUnique: async ({ where }: { where: { token: string } }) =>
        where.token === 'sessao' ? { is_logged: true, user: { id: 7, access_level: 'motorista', phone: '62900000000' } } : null
    },
    notifications: { updateMany: async (args: unknown) => { calls.push(args); } }
  };
  const globals = globalThis as unknown as { prisma?: unknown };
  const previous = globals.prisma;
  globals.prisma = db;
  try {
    const { registerNotifications } = await import('./notifications');
    const compatibility = await import('./routes');
    assert.equal(compatibility.parseRawJsonBody, parseRawJsonBody);

    type Handler = (req: Request, res: Response) => Promise<void>;
    const handlers = new Map<string, Handler>();
    const app = {
      all: (paths: string[], handler: Handler) => paths.forEach(path => handlers.set(path, handler))
    };
    registerNotifications(app as unknown as Express);

    for (const path of ['/notificacoes/read', '/api/notificacoes/read']) {
      for (const raw of [false, true]) {
        const body = { token: 'sessao', ids: ['11', 12, 'invalido'] };
        let payload: unknown;
        const res = { json: (value: unknown) => { payload = value; } };
        await handlers.get(path)!({ body: raw ? Buffer.from(JSON.stringify(body)) : body, headers: {}, query: {} } as Request, res as Response);
        assert.deepEqual(payload, { success: true });
        assert.deepEqual((calls.at(-1) as { where: unknown }).where, { user_id: 7, read_at: null, id: { in: [11, 12] } });
      }
    }
    assert.equal(calls.length, 4);

    let status: number | undefined;
    let payload: unknown;
    const res = {
      status: (value: number) => { status = value; return res; },
      json: (value: unknown) => { payload = value; }
    };
    await handlers.get('/api/notificacoes/read')!({ body: Buffer.from('{'), headers: {}, query: {} } as Request, res as Response);
    assert.equal(status, 401);
    assert.deepEqual(payload, { success: false, message: 'Faça login para ver as notificações.' });
    assert.equal(calls.length, 4);
  } finally {
    if (previous === undefined) delete globals.prisma;
    else globals.prisma = previous;
  }
});
