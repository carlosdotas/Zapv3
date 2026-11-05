import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TestCallsRepository } from './test-calls-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)('chamadas de teste no MySQL isolado', () => {
  const url = new URL(testUrl ?? 'mysql://localhost/zap_test');
  if (!url.pathname.endsWith('_test') || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Use somente um banco local de teste com nome terminado em _test.');
  const pool = mysql.createPool(testUrl ?? 'mysql://localhost/zap_test');
  const repository = new TestCallsRepository(pool);
  const company = randomUUID(), otherCompany = randomUUID(), driver = randomUUID(), otherDriver = randomUUID(), actor = randomUUID();
  beforeAll(async () => {
    for (const file of ['002_identity_bootstrap.sql', '003_pickup_test_calls.sql']) {
      const sql = (await readFile(resolve(process.cwd(), '../../database/migrations', file), 'utf8')).replace(/^--.*$/gm, '');
      for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await pool.query(statement);
    }
    for (const id of [driver, otherDriver, actor]) await pool.execute('INSERT INTO users (id,name,phone_e164,password_hash) VALUES (?,?,?,?)', [id, 'Teste', id.slice(0, 16), 'hash']);
    for (const id of [company, otherCompany]) await pool.execute('INSERT INTO companies (id,name) VALUES (?,?)', [id, 'Empresa teste']);
    await pool.execute("INSERT INTO roles (id,code) VALUES (?,'company_admin') ON DUPLICATE KEY UPDATE code=VALUES(code)", [randomUUID()]);
    await pool.execute("INSERT INTO company_members (id,company_id,user_id,role_id) SELECT ?,?,?,id FROM roles WHERE code='company_admin'", [randomUUID(), company, actor]);
    await pool.execute('INSERT INTO professional_profiles (user_id) VALUES (?),(?)', [driver, otherDriver]);
    await pool.execute('INSERT INTO company_professionals (company_id,professional_user_id) VALUES (?,?)', [company, driver]);
  });
  afterAll(async () => { await pool.end(); });

  it('restringe o motorista vinculado e aceita somente uma resposta concorrente', async () => {
    expect(await repository.isCompanyMember(actor, company)).toBe(true);
    expect(await repository.isCompanyMember(actor, otherCompany)).toBe(false);
    expect(await repository.create(otherCompany, driver, actor)).toBeNull();
    expect(await repository.create(company, otherDriver, actor)).toBeNull();
    expect(await repository.create(company, driver, otherDriver)).toBeNull();
    const call = await repository.create(company, driver, actor);
    expect(call?.status).toBe('pending');
    expect(Date.parse(call!.expiresAt) - Date.now()).toBeGreaterThan(25_000);
    expect(Date.parse(call!.expiresAt) - Date.now()).toBeLessThanOrEqual(30_000);
    expect((await repository.pending(driver)).map(item => item.id)).toContain(call!.id);
    expect(await repository.respond(call!.id, otherDriver, 'accepted')).toBeNull();
    const answers = await Promise.all([repository.respond(call!.id, driver, 'accepted'), repository.respond(call!.id, driver, 'rejected')]);
    expect(answers.filter(Boolean)).toHaveLength(1);
    expect(await repository.pending(driver)).toHaveLength(0);
    const [events] = await pool.execute<RowDataPacket[]>('SELECT status FROM pickup_test_call_events WHERE call_id=?', [call!.id]);
    expect(events.map(event => event.status)).toContain('pending');
    expect(events).toHaveLength(2);
  });

  it('impede resposta depois do prazo e registra a expiração', async () => {
    const call = await repository.create(company, driver, actor);
    await pool.execute('UPDATE pickup_test_calls SET expires_at=DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE id=?', [call!.id]);
    expect(await repository.respond(call!.id, driver, 'accepted')).toBeNull();
    expect((await repository.expire(call!.id))?.status).toBe('expired');
    expect(await repository.expire(call!.id)).toBeNull();
  });

  it('deixa de entregar e aceitar chamadas quando o vínculo é revogado', async () => {
    const call = await repository.create(company, driver, actor);
    await pool.execute("UPDATE company_professionals SET status='revoked' WHERE company_id=? AND professional_user_id=?", [company, driver]);
    expect((await repository.pending(driver)).map(item => item.id)).not.toContain(call!.id);
    expect(await repository.respond(call!.id, driver, 'accepted')).toBeNull();
    await pool.execute("UPDATE company_professionals SET status='active' WHERE company_id=? AND professional_user_id=?", [company, driver]);
  });

  it('só grava GPS em serviço e marca a conexão como encerrada', async () => {
    expect(await repository.recordLocation(driver, -16.68, -49.25, 20)).toBe(false);
    await repository.setDuty(driver, true);
    expect(await repository.recordLocation(driver, -16.68, -49.25, 20)).toBe(true);
    await repository.setOffline(driver);
    const [state] = await pool.execute<RowDataPacket[]>('SELECT on_duty,online FROM professional_duty_state WHERE professional_user_id=?', [driver]);
    expect(Number(state[0].on_duty)).toBe(1);
    expect(Number(state[0].online)).toBe(0);
    await repository.setDuty(driver, false);
    expect(await repository.recordLocation(driver, -16.67, -49.24, 20)).toBe(false);
  });
});
