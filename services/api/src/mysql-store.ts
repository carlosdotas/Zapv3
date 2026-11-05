import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import type { Role, User } from './domain.js';
import { hashPassword } from './security.js';
import type { IdentityStore } from './store.js';

type UserRow = RowDataPacket & { id: string; name: string; phone_e164: string; password_hash: string; status: string };
type RoleRow = RowDataPacket & { code: Role };

export class MysqlStore implements IdentityStore {
  readonly pool: Pool;
  private configured = true;
  ready: Promise<void>;
  callsReady: Promise<void>;

  constructor() {
    const host = process.env.DB_HOST?.trim();
    if (host && !host.includes('COLOQUE_AQUI')) {
      this.pool = mysql.createPool({ host, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 5 });
    } else if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('COLOQUE_AQUI')) {
      this.pool = mysql.createPool({ uri: process.env.DATABASE_URL, timezone: 'Z', connectionLimit: 5 });
    } else {
      this.configured = false;
      this.pool = mysql.createPool({ host: '127.0.0.1', port: 1, connectionLimit: 1 });
    }
    this.ready = this.initialize();
    this.callsReady = this.ready.then(() => this.initializeCalls());
    void this.callsReady.catch(() => {});
  }

  private async initialize() {
    if (!this.configured) throw new Error('Configure as variáveis de conexão do MySQL.');
    const connection = await this.pool.getConnection();
    let locked = false;
    try {
      const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('zap_identity_bootstrap', 30) AS acquired");
      if (lock[0]?.acquired !== 1) throw new Error('Não foi possível obter o bloqueio de inicialização da identidade.');
      locked = true;
      for (const file of ['002_identity_bootstrap.sql', '006_auth_sessions.sql']) {
        const migration = await readFile(resolve(__dirname, 'migrations', file), 'utf8')
          .catch(() => readFile(resolve(__dirname, '../../../database/migrations', file), 'utf8'));
        for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) await connection.query(statement);
      }
      await this.bootstrap(connection);
    } finally {
      if (locked) await connection.query("SELECT RELEASE_LOCK('zap_identity_bootstrap')");
      connection.release();
    }
  }

  private async initializeCalls() {
    const connection = await this.pool.getConnection();
    let locked = false;
    try {
      const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('zap_calls_bootstrap', 30) AS acquired");
      if (lock[0]?.acquired !== 1) throw new Error('Não foi possível obter o bloqueio de inicialização das chamadas.');
      locked = true;
      for (const file of ['003_pickup_calls.sql', '004_pickup_self_test.sql', '005_pickup_test_details.sql']) {
        const migration = await readFile(resolve(__dirname, 'migrations', file), 'utf8')
          .catch(() => readFile(resolve(__dirname, '../../../database/migrations', file), 'utf8'));
        for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) await connection.query(statement);
      }
    } finally {
      if (locked) await connection.query("SELECT RELEASE_LOCK('zap_calls_bootstrap')");
      connection.release();
    }
  }

  private async bootstrap(connection: PoolConnection) {
    const phone = process.env.DEFAULT_ADMIN_PHONE?.trim();
    const password = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!phone || !password) return;
    if (!/^\+[1-9]\d{9,14}$/.test(phone)) throw new Error('DEFAULT_ADMIN_PHONE deve estar no formato internacional, por exemplo +55 seguido do DDD e telefone.');
    const [existingAdmins] = await connection.query<RowDataPacket[]>("SELECT 1 FROM user_global_roles ugr JOIN roles r ON r.id = ugr.role_id WHERE r.code = 'platform_admin' LIMIT 1");
    if (existingAdmins.length) return;
    const [existingUsers] = await connection.execute<RowDataPacket[]>('SELECT id FROM users WHERE phone_e164 = ?', [phone]);
    if (existingUsers.length) throw new Error('O telefone de bootstrap já existe; atribua o acesso administrativo por um procedimento autorizado.');
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await connection.beginTransaction();
    try {
      await connection.execute('INSERT INTO users (id, name, phone_e164, password_hash) VALUES (?, ?, ?, ?)', [id, process.env.DEFAULT_ADMIN_NAME?.trim() || 'Administrador principal', phone, passwordHash]);
      for (const role of ['platform_admin', 'professional']) {
        await connection.execute('INSERT INTO roles (id, code) VALUES (?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code)', [randomUUID(), role]);
        await connection.execute('INSERT INTO user_global_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?', [id, role]);
      }
      await connection.execute('INSERT INTO professional_profiles (user_id) VALUES (?)', [id]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
  }

  async createProfessional(name: string, phone: string, password: string): Promise<User> {
    await this.ready;
    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('INSERT INTO users (id, name, phone_e164, password_hash) VALUES (?, ?, ?, ?)', [id, name, phone, passwordHash]);
      await connection.execute('INSERT INTO roles (id, code) VALUES (?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code)', [randomUUID(), 'professional']);
      await connection.execute('INSERT INTO user_global_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?', [id, 'professional']);
      await connection.execute('INSERT INTO professional_profiles (user_id) VALUES (?)', [id]);
      await connection.commit();
      return { id, name, phone, passwordHash, roles: ['professional'], companyIds: [], status: 'active' };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new Error('PHONE_EXISTS');
      throw error;
    } finally { connection.release(); }
  }

  async findByPhone(phone: string) { return this.find('phone_e164', phone); }
  async findById(id: string) { return this.find('id', id); }
  async createSession(id: string, userId: string) {
    await this.ready;
    await this.pool.execute('INSERT INTO auth_sessions (id,user_id,expires_at) VALUES (?,?,UTC_TIMESTAMP()+INTERVAL 365 DAY)',[id,userId]);
  }
  async sessionValid(id: string, userId: string, legacy: boolean) {
    await this.ready;
    const [rows]=await this.pool.execute<RowDataPacket[]>('SELECT revoked_at,expires_at,expires_at<=UTC_TIMESTAMP() AS expired,expires_at<UTC_TIMESTAMP()+INTERVAL 335 DAY AS renew FROM auth_sessions WHERE id=? AND user_id=?',[id,userId]);
    if(!rows.length)return legacy;
    if(rows[0].revoked_at || rows[0].expired)return false;
    if(rows[0].renew)await this.pool.execute('UPDATE auth_sessions SET expires_at=UTC_TIMESTAMP()+INTERVAL 365 DAY WHERE id=? AND user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP()',[id,userId]);
    return true;
  }
  async revokeSession(id: string, userId: string, stopDuty: boolean) {
    await this.ready;
    const callsAvailable=stopDuty ? await this.callsReady.then(()=>true,()=>false) : false;
    const db=await this.pool.getConnection();
    try {
      await db.beginTransaction();
      if(callsAvailable) {
        await db.execute('UPDATE professional_duty SET on_duty=0,last_seen_at=UTC_TIMESTAMP(3) WHERE user_id=?',[userId]);
        await db.execute("UPDATE professional_profiles SET availability='offline' WHERE user_id=?",[userId]);
      }
      await db.execute('INSERT INTO auth_sessions (id,user_id,expires_at,revoked_at) VALUES (?,?,UTC_TIMESTAMP()+INTERVAL 365 DAY,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE revoked_at=IF(user_id=VALUES(user_id),COALESCE(revoked_at,UTC_TIMESTAMP()),revoked_at)',[id,userId]);
      await db.commit();
    } catch(error) { await db.rollback(); throw error; } finally { db.release(); }
  }
  private async find(field: 'id' | 'phone_e164', value: string): Promise<User | undefined> {
    await this.ready;
    const [rows] = await this.pool.execute<UserRow[]>(`SELECT id, name, phone_e164, password_hash, status FROM users WHERE ${field} = ? LIMIT 1`, [value]);
    const row = rows[0];
    if (!row) return undefined;
    const [roles] = await this.pool.execute<RoleRow[]>('SELECT r.code FROM roles r JOIN user_global_roles ugr ON ugr.role_id = r.id WHERE ugr.user_id = ?', [row.id]);
    return { id: row.id, name: row.name, phone: row.phone_e164, passwordHash: row.password_hash, status: row.status === 'active' ? 'active' : 'blocked', roles: roles.map(r => r.code), companyIds: [] };
  }
  async close() { await this.pool.end(); }
}
