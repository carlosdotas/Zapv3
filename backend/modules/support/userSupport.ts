import bcrypt from 'bcryptjs';
import { prisma } from '../../db';
import { toInt } from '../../mappers';

export const digitsOf = (value: unknown) => String(value ?? '').replace(/\D/g, '');

export function phoneVariants(raw: unknown): string[] {
  const d = digitsOf(raw);
  if (!d) return [];
  const variants = new Set<string>([d]);
  if (d.startsWith('55') && d.length > 11) variants.add(d.slice(2));
  else variants.add(`55${d}`);
  return [...variants];
}

export async function findUserByPhone(raw: unknown) {
  const variants = phoneVariants(raw);
  if (!variants.length) return null;
  const matches = await prisma.users.findMany({ where: { phone: { in: variants } } });
  const exact = digitsOf(raw);
  // Com telefones duplicados (com/sem 55), prioriza o número exato e quem tem senha
  const score = (u: { phone: string | null; password: string | null }) => (u.password ? 2 : 0) + (u.phone === exact ? 1 : 0);
  return matches.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export async function findUserFromBody(body: any) {
  const id = toInt(body.id ?? body.user_id);
  if (id) {
    const byId = await prisma.users.findUnique({ where: { id } });
    if (byId) return byId;
  }
  if (digitsOf(body.phone).length >= 8) return findUserByPhone(body.phone);
  return null;
}

export async function orderCounts(): Promise<Map<number, number>> {
  const groups = await prisma.orders.groupBy({ by: ['client_id'], _count: { _all: true } });
  const map = new Map<number, number>();
  for (const g of groups) if (g.client_id) map.set(g.client_id, g._count._all);
  return map;
}

export const hashPassword = (plain: string) => bcrypt.hashSync(plain, 10);
