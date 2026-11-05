import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionGate } from '../../session-gate';
import { homeUrl, registrationUrl } from '../../navigation';
import { Dashboard } from './dashboard';
import './style.css';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
createRoot(document.getElementById('root')!).render(<StrictMode><SessionGate portal="company" apiUrl={apiUrl} registerHref={registrationUrl(import.meta.env.VITE_PROFESSIONAL_URL)} homeHref={homeUrl()}>{(session,logout)=><Dashboard apiUrl={apiUrl} token={session.token} user={session.user} onLogout={logout}/>}</SessionGate></StrictMode>);
