import { useId, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons.js';
import { MapBackdrop } from './map-backdrop.js';

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`zap-brand${compact ? ' zap-brand--compact' : ''}`}>
    <span className="zap-brand__mark"><img src="/logo.svg" alt="" width="64" height="64" /></span>
    <span className="zap-brand__name">Encomendas<span>Zap</span></span>
  </span>;
}

export function AuthShell({ description, children, footer, back, variant = 'login', portal, homeHref = '/' }: {
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  back?: ReactNode;
  variant?: 'login' | 'register';
  portal: string;
  homeHref?: string;
}) {
  return <main className={`auth-page auth-page--${variant}`}>
    <MapBackdrop />
    <div className="auth-page__top"><a className="home-return" href={homeHref}><Icon name="arrow-left" size={16} /> Início</a><span>{portal}</span></div>
    <section className="auth-card" aria-label={variant === 'register' ? 'Cadastro de motorista' : portal}>
      {back}
      <header className="auth-card__header">
        <h1><Brand /></h1>
        <p className="auth-description">{description}</p>
      </header>
      <div className="auth-card__body">{children}</div>
      <footer className="auth-card__footer">{footer ?? 'Criado por: Carlos Dottas'}</footer>
    </section>
  </main>;
}

export function Field({ label, icon, children }: { label: string; icon: IconName; children: ReactNode }) {
  return <label className="auth-field"><span>{label}</span><span className="auth-field__control"><Icon name={icon} size={16} />{children}</span></label>;
}

export function PasswordField({ value, onChange, registration = false, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  registration?: boolean;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return <div className="auth-field">
    <label htmlFor={id}>{registration ? 'Senha de acesso' : 'Senha'}</label>
    <div className="auth-field__control">
      <Icon name="lock" size={16} />
      <input id={id} name="password" type={visible ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} autoComplete={registration ? 'new-password' : 'current-password'} placeholder={registration ? 'Mínimo de 8 caracteres' : '••••••'} minLength={registration ? 8 : undefined} required disabled={disabled} className="password-input" />
      <button className="password-toggle" type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar senha' : 'Ver senha'} aria-pressed={visible} disabled={disabled}><Icon name={visible ? 'eye-off' : 'eye'} size={16} /></button>
    </div>
    {registration && <small className="field-hint">Use pelo menos 8 caracteres para proteger sua conta.</small>}
  </div>;
}
