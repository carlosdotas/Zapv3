import type { ReactNode } from 'react';

export { AuthShell, Brand, Field, PasswordField } from './auth-shell.js';
export { Authentication } from './authentication.js';
export { Icon } from './icons.js';
export { MapBackdrop } from './map-backdrop.js';

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return <main className="legacy-shell"><p className="legacy-brand">ZAP ENCOMENDAS</p><h1>{title}</h1>{children}</main>;
}
