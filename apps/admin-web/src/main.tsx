import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthShell, Icon, MobileTools } from '@zap/ui';
import { SessionGate } from '../../session-gate';
import { homeUrl, registrationUrl } from '../../navigation';
import './style.css';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
createRoot(document.getElementById('root')!).render(<StrictMode><SessionGate portal="admin" apiUrl={apiUrl} registerHref={registrationUrl(import.meta.env.VITE_PROFESSIONAL_URL)} homeHref={homeUrl()}>{(session,logout)=><AuthShell description="Acesso confirmado à sua conta" portal="Administração" homeHref={homeUrl()}><section className="success-panel" aria-live="polite"><Icon name="check" size={48}/><h2>Bem-vindo(a)!</h2><p>{session.user.name}, seu acesso foi confirmado.</p><p className="success-panel__note">As próximas telas da operação estarão disponíveis em breve.</p><MobileTools/><button className="primary-button" type="button" onClick={logout}>Sair da conta</button></section></AuthShell>}</SessionGate></StrictMode>);
