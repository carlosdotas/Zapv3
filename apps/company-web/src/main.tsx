import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Authentication } from '@zap/ui';
import { createAuthActions } from '../../auth-api';
import { homeUrl, registrationUrl } from '../../navigation';
import { CompanyDashboard } from './dashboard';
import './style.css';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
const { signIn } = createAuthActions(apiUrl);

createRoot(document.getElementById('root')!).render(<StrictMode><Authentication portal="company" onLogin={signIn} registerHref={registrationUrl(import.meta.env.VITE_PROFESSIONAL_URL)} homeHref={homeUrl()} renderAuthenticated={(session, signOut) => session.token ? <CompanyDashboard apiUrl={apiUrl} token={session.token} name={session.user.name} onSignOut={signOut} /> : null} /></StrictMode>);
