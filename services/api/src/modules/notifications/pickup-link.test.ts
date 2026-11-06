import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { PickupStore } from './pickup-store.js';

function setup({ admin = true, driver = true, status }: { admin?: boolean; driver?: boolean; status?: string } = {}) {
  const db = {
    beginTransaction: vi.fn(async () => {}), commit: vi.fn(async () => {}), rollback: vi.fn(async () => {}), release: vi.fn(),
    execute: vi.fn(async (sql: string) => {
      if (sql.startsWith('SELECT c.id')) return [admin ? [{ id: 'company' }] : []];
      if (sql.startsWith('SELECT u.id')) return [driver ? [{ id: 'driver' }] : []];
      if (sql.startsWith('SELECT status')) return [status ? [{ status }] : []];
      return [{ affectedRows: 1 }];
    }),
  };
  const pool = { getConnection: vi.fn(async () => db) } as unknown as Pool;
  return { db, store: new PickupStore(pool) };
}

describe('autorização de motorista por telefone', () => {
  it('grava vínculo e autor em uma transação', async () => {
    const { db, store } = setup();
    await expect(store.linkProfessional('admin', 'company', '+5562988887777')).resolves.toEqual({ linked: true });
    expect(db.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO company_professionals'))).toBe(true);
    expect(db.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO company_professional_link_events'))).toBe(true);
    expect(db.commit).toHaveBeenCalledOnce(); expect(db.release).toHaveBeenCalledOnce();
  });
  it('recusa acesso de quem não administra a transportadora antes de consultar o telefone', async () => {
    const { db, store } = setup({ admin: false });
    await expect(store.linkProfessional('attendant', 'company', '+5562988887777')).rejects.toThrow('FORBIDDEN');
    expect(db.execute).toHaveBeenCalledOnce(); expect(db.rollback).toHaveBeenCalledOnce();
  });
  it('não reativa um vínculo revogado', async () => {
    const { db, store } = setup({ status: 'revoked' });
    await expect(store.linkProfessional('admin', 'company', '+5562988887777')).rejects.toThrow('LINK_INACTIVE');
    expect(db.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO'))).toBe(false);
    expect(db.rollback).toHaveBeenCalledOnce();
  });
  it('reutiliza vínculo ativo sem duplicar o registro de auditoria', async () => {
    const { db, store } = setup({ status: 'active' });
    await expect(store.linkProfessional('admin', 'company', '+5562988887777')).resolves.toEqual({ linked: true });
    expect(db.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO'))).toBe(false);
    expect(db.commit).toHaveBeenCalledOnce();
  });
  it('desfaz o vínculo se não for possível registrar a auditoria', async () => {
    const { db, store } = setup();
    db.execute.mockImplementation(async sql => {
      if (sql.startsWith('SELECT c.id')) return [[{ id: 'company' }]];
      if (sql.startsWith('SELECT u.id')) return [[{ id: 'driver' }]];
      if (sql.startsWith('SELECT status')) return [[]];
      if (sql.startsWith('INSERT INTO company_professional_link_events')) throw new Error('DB_ERROR');
      return [{ affectedRows: 1 }];
    });
    await expect(store.linkProfessional('admin', 'company', '+5562988887777')).rejects.toThrow('DB_ERROR');
    expect(db.rollback).toHaveBeenCalledOnce(); expect(db.commit).not.toHaveBeenCalled();
  });
  it('informa indisponibilidade do vínculo sem tentar gravar quando a auditoria não foi preparada', async () => {
    const getConnection = vi.fn();
    const store = new PickupStore({ getConnection } as unknown as Pool, Promise.reject(new Error('migration failed')));
    await expect(store.linkProfessional('admin', 'company', '+5562988887777')).rejects.toThrow('LINK_UNAVAILABLE');
    expect(getConnection).not.toHaveBeenCalled();
  });
});
