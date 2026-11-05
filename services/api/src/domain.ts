export const ROLES = ['platform_admin', 'company_admin', 'attendant', 'professional'] as const;
export type Role = typeof ROLES[number];
export type User = { id: string; name: string; phone: string; passwordHash: string; roles: Role[]; companyIds: string[]; status: 'active' | 'blocked' };
export const transitions: Record<string, string[]> = { draft: ['open', 'cancelled'], open: ['accepted', 'cancelled'], accepted: ['arrived_pickup', 'cancelled'], arrived_pickup: ['collected', 'cancelled'], collected: ['delivered'], delivered: [], cancelled: [] };
