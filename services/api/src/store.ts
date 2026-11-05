import { randomUUID } from 'node:crypto';
import type { Role, User } from './domain.js';
import { hashPassword } from './security.js';
export interface IdentityStore {
  ready: Promise<void>;
  callsReady?: Promise<void>;
  createProfessional(name: string, phone: string, password: string): Promise<User>;
  findByPhone(phone: string): User | undefined | Promise<User | undefined>;
  findById(id: string): User | undefined | Promise<User | undefined>;
  close?(): Promise<void>;
}
export class MemoryStore {
  users = new Map<string, User>();
  ready: Promise<void>;
  constructor() { this.ready = this.seed(); }
  private async seed() {
    const passwordHash = await hashPassword('Profissional123!');
    this.users.set('dev-professional', { id: 'dev-professional', name: 'Profissional de Desenvolvimento', phone: '+5511999999999', passwordHash, roles: ['professional'], companyIds: [], status: 'active' });

    const adminPhone = process.env.DEFAULT_ADMIN_PHONE?.trim();
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!adminPhone || !adminPassword) return;

    this.users.set('bootstrap-platform-admin', {
      id: 'bootstrap-platform-admin',
      name: process.env.DEFAULT_ADMIN_NAME?.trim() || 'Administrador principal',
      phone: adminPhone,
      passwordHash: await hashPassword(adminPassword),
      roles: ['platform_admin', 'company_admin', 'professional'],
      companyIds: [],
      status: 'active',
    });
  }
  async createProfessional(name: string, phone: string, password: string) { if ([...this.users.values()].some(u => u.phone === phone)) throw new Error('PHONE_EXISTS'); const user: User = { id: randomUUID(), name, phone, passwordHash: await hashPassword(password), roles: ['professional'], companyIds: [], status: 'active' }; this.users.set(user.id, user); return user; }
  findByPhone(phone: string) { return [...this.users.values()].find(user => user.phone === phone); }
  findById(id: string) { return this.users.get(id); }
  addRole(id: string, role: Role) { const user = this.users.get(id); if (!user) return; if (!user.roles.includes(role)) user.roles.push(role); }
}
