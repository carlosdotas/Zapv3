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

  constructor() {
    const host = process.env.DB_HOST?.trim();
    if (host && !host.includes('COLOQUE_AQUI')) {
      this.pool = mysql.createPool({ host, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, timezone: 'Z', connectionLimit: 5 });
    } else if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('COLOQUE_AQUI')) {
      this.pool = mysql.createPool(process.env.DATABASE_URL);
    } else {
      this.configured = false;
      this.pool = mysql.createPool({ host: '127.0.0.1', port: 1, connectionLimit: 1 });
    }
    this.ready = this.initialize();
  }

  private async initialize() {
    if (!this.configured) throw new Error('Configure as variáveis de conexão do MySQL.');
    const connection = await this.pool.getConnection();
    let locked = false;
    try {
      const [lock] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('zap_identity_bootstrap', 30) AS acquired");
      if (lock[0]?.acquired !== 1) throw new Error('Não foi possível obter o bloqueio de inicialização da identidade.');
      locked = true;
      const migration = await readFile(resolve(__dirname, 'migrations', '002_identity_bootstrap.sql'), 'utf8')
        .catch(() => readFile(resolve(__dirname, '../../../database/migrations/002_identity_bootstrap.sql'), 'utf8'));
      for (const statement of migration.split(';').map(part => part.trim()).filter(Boolean)) await connection.query(statement);
      const pickupMigration = await readFile(resolve(__dirname, 'migrations', '003_pickup_calls.sql'), 'utf8')
        .catch(() => readFile(resolve(__dirname, '../../../database/migrations/003_pickup_calls.sql'), 'utf8'));
      for (const statement of pickupMigration.split(';').map(part => part.trim()).filter(Boolean)) await connection.query(statement);
      await this.bootstrap(connection);
    } finally {
      if (locked) await connection.query("SELECT RELEASE_LOCK('zap_identity_bootstrap')");
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
