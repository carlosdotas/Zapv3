import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDbStore } from './localDb';

test('armazenamento de compatibilidade mantém padrões, sessões e persistência em diretório isolado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'zap-local-store-'));
  writeFileSync(join(dir, 'importedUsers.legacy.json'), JSON.stringify([{ id: 1, name: 'Usuário teste', phone: '62911112222', access_level: 'cliente' }]));
  const store = new LocalDbStore(dir);
  const call = (table: string, method: string, params: object = {}) => store.execute(table, method, [params]);
  try {
    assert.equal((await call('app_settings', 'findUnique', { where: { key: 'global_config' } })).key, 'global_config');
    assert.ok((await call('config_cities', 'findMany')).length > 0);
    assert.deepEqual(await call('locais', 'findMany'), []);
    assert.deepEqual(await call('locations', 'findMany'), []);
    const users = await call('users', 'findMany');
    assert.equal(users.length, 1);
    assert.equal(users[0].id, 1);
    const session = await call('user_sessions', 'create', { data: { user_id: 1, token: 'sessao-teste', is_logged: true } });
    assert.ok(session.id);
    const loaded = await call('user_sessions', 'findUnique', { where: { token: 'sessao-teste' }, include: { user: true } });
    assert.equal(loaded.user.id, 1);
    store.flush();
    const restored = new LocalDbStore(dir);
    assert.equal((await restored.execute('user_sessions', 'findUnique', [{ where: { token: 'sessao-teste' } }])).user_id, 1);
  } finally {
    store.flush();
    rmSync(dir, { recursive: true, force: true });
  }
});
