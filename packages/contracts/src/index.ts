export const roles = ['platform_admin','company_admin','attendant','professional'] as const;
export type Role = typeof roles[number];
export type SessionUser = { id: string; name: string; roles: Role[] };
