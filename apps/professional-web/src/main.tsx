import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Authentication } from '@zap/ui';
import { createAuthActions } from '../../auth-api';
import { homeUrl } from '../../navigation';
import './style.css';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
const { signIn, signUp } = createAuthActions(apiUrl);

createRoot(document.getElementById('root')!).render(<StrictMode><Authentication portal="professional" onLogin={signIn} onRegister={signUp} homeHref={homeUrl()} /></StrictMode>);
