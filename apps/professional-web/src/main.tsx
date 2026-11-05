import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionGate } from '../../session-gate';
import { homeUrl } from '../../navigation';
import { Dashboard } from './dashboard';
import './style.css';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
createRoot(document.getElementById('root')!).render(<StrictMode><SessionGate portal="professional" apiUrl={apiUrl} homeHref={homeUrl()}>{(session,logout)=><Dashboard apiUrl={apiUrl} token={session.token} userId={session.user.id} userName={session.user.name} onLogout={logout}/>}</SessionGate></StrictMode>);
