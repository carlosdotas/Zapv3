import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AuthShell, Field, PasswordField } from './auth-shell.js';
import { Icon } from './icons.js';
import { MobileTools } from './mobile-tools.js';

type Credentials = { phone: string; password: string };
type Registration = Credentials & { name: string };
type Authenticated = { token?: string; user: { name: string } };
type Portal = 'company' | 'professional' | 'admin';
type Props = {
  portal: Portal;
  onLogin: (input: Credentials) => Promise<Authenticated>;
  onRegister?: (input: Registration) => Promise<Authenticated>;
  registerHref?: string;
  homeHref?: string;
  renderAuthenticated?: (session: Authenticated, signOut: () => void) => ReactNode;
};

const portalLabels: Record<Portal, string> = { company: 'Portal da transportadora', professional: 'Portal do motorista', admin: 'Administração' };

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length > 11 && digits.startsWith('55') ? digits.slice(2, 13) : digits.slice(0, 11);
}

function formatPhone(value: string) {
  const digits = phoneDigits(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const split = digits.length > 10 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

export function Authentication({ portal, onLogin, onRegister, registerHref = '/profissional/#cadastro', homeHref = '/', renderAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(() => onRegister && window.location.hash === '#cadastro' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [userName, setUserName] = useState('');
  const [session, setSession] = useState<Authenticated | null>(null);
  const registration = mode === 'register';

  useEffect(() => {
    function syncMode() {
      setMode(onRegister && window.location.hash === '#cadastro' ? 'register' : 'login');
      setMessage('');
    }
    window.addEventListener('hashchange', syncMode);
    return () => window.removeEventListener('hashchange', syncMode);
  }, [onRegister]);

  function switchMode(next: 'login' | 'register') {
    setMessage('');
    setMode(next);
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next === 'register' ? '#cadastro' : ''}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const digits = phoneDigits(phone);
    if (digits.length < 10) { setMessage('Digite um número de telefone celular válido com DDD.'); return; }
    if (registration && name.trim().length < 2) { setMessage('Informe seu nome completo.'); return; }
    if (registration && password.length < 8) { setMessage('Escolha uma senha com pelo menos 8 caracteres.'); return; }
    setMessage('');
    setBusy(true);
    try {
      const input = { phone: `+55${digits}`, password };
      const result = registration && onRegister ? await onRegister({ ...input, name: name.trim() }) : await onLogin(input);
      setUserName(result.user.name);
      setSession(result);
      setPassword('');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setMessage(code === 'PHONE_EXISTS' ? 'Este telefone já está cadastrado. Entre com sua senha.'
        : code === 'REGISTERED_LOGIN_FAILED' ? 'Cadastro criado. Entre com seu telefone e senha para continuar.'
          : registration ? 'Não foi possível concluir o cadastro. Confira seus dados e tente novamente.'
            : 'Não foi possível entrar. Confira seu telefone e senha e tente novamente.');
      if (code === 'REGISTERED_LOGIN_FAILED') { setMode('login'); window.history.replaceState(null, '', window.location.pathname + window.location.search); }
    } finally { setBusy(false); }
  }

  function signOut() { setUserName(''); setSession(null); setPassword(''); switchMode('login'); }

  if (session && renderAuthenticated) return <>{renderAuthenticated(session, signOut)}</>;

  const description = userName ? 'Acesso confirmado à sua conta'
    : registration ? 'Cadastro de motorista parceiro'
      : 'Entre com seu telefone e senha para acessar';

  return <AuthShell description={description} variant={registration ? 'register' : 'login'} portal={portalLabels[portal]} homeHref={homeHref} showHomeLink={portal === 'admin' || registration}
    back={registration && !userName ? <button className="auth-back" type="button" disabled={busy} onClick={() => switchMode('login')}><Icon name="arrow-left" size={16} /> Voltar</button> : undefined}>
    {userName ? <section className="success-panel" aria-live="polite">
      <Icon name="check" size={48} />
      <h2>{registration ? 'Cadastro concluído!' : 'Bem-vindo(a)!'}</h2>
      <p>{userName}, seu acesso foi confirmado.</p>
      <p className="success-panel__note">As próximas telas da operação estarão disponíveis em breve.</p>
      <MobileTools />
      <button className="primary-button" type="button" onClick={signOut}>Voltar ao login <Icon name="arrow-right" size={16} /></button>
      <a className="auth-home-link" href={homeHref}>Ir para a página inicial</a>
    </section> : <form onSubmit={submit} className="auth-form" aria-busy={busy}>
      {message && <p className="form-message" role="alert"><Icon name="alert" size={16} /><span>{message}</span></p>}
      {registration && <Field label="Nome completo" icon="user"><input name="name" value={name} onChange={event => setName(event.target.value)} placeholder="Nome e sobrenome do contato" autoComplete="name" maxLength={120} required autoFocus disabled={busy} /></Field>}
      <Field label={registration ? 'Telefone celular / WhatsApp' : 'Telefone celular'} icon="phone"><input name="phone" type="tel" inputMode="tel" value={phone} onChange={event => setPhone(formatPhone(event.target.value))} placeholder="(62) 99999-9999" autoComplete="tel-national" required autoFocus={!registration} disabled={busy} /></Field>
      <PasswordField value={password} onChange={setPassword} registration={registration} disabled={busy} />
      <button className={`primary-button${registration ? ' primary-button--orange' : ''}`} type="submit" disabled={busy}>
        {busy ? <><span className="button-spinner" aria-hidden="true" />{registration ? 'Cadastrando...' : 'Entrando...'}</> : <>{registration ? 'Concluir cadastro de motorista' : 'Entrar no Sistema'}<Icon name="arrow-right" size={16} /></>}
      </button>
      <div className="auth-switch">
        {registration ? <><span>Já tem uma conta? </span><button type="button" onClick={() => switchMode('login')} disabled={busy}>Fazer login</button></>
          : <><span>Quer se cadastrar? </span>{onRegister ? <button type="button" className="auth-switch__register" onClick={() => switchMode('register')} disabled={busy}>Cadastrar</button> : <a className="auth-switch__register" href={registerHref}>Cadastrar como motorista</a>}</>}
      </div>
      {portal !== 'professional' && <p className="restricted-note"><Icon name="shield" size={14} />{portal === 'admin' ? 'Acessos administrativos são concedidos pela plataforma.' : 'O acesso da transportadora é concedido pela equipe da Zap.'}</p>}
      {registration && <p className="restricted-note"><Icon name="shield" size={14} />Cadastro exclusivo para motoristas parceiros de coletas e entregas.</p>}
    </form>}
  </AuthShell>;
}
