import type { ReactNode } from 'react';

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return <main className="legacy-shell"><p className="legacy-brand">ZAP ENCOMENDAS</p><h1>{title}</h1>{children}</main>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? 'zap-brand zap-brand--compact' : 'zap-brand'}><span className="zap-brand__mark">Z</span><span>Encomendas<span className="zap-brand__accent">Zap</span></span></div>;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="auth-page"><div className="auth-page__glow" /><section className="auth-card">
    <header className="auth-card__header"><Brand /><p className="auth-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p></header>
    <div className="auth-card__body">{children}</div>
    {footer && <footer className="auth-card__footer">{footer}</footer>}
  </section></main>;
}

export function Field({ label, icon, children }: { label: string; icon: string; children: ReactNode }) {
  return <label className="auth-field"><span>{label}</span><div className="auth-field__control"><b aria-hidden="true">{icon}</b>{children}</div></label>;
}
