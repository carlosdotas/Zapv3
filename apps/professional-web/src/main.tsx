import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Authentication } from '@zap/ui';
import { createAuthActions } from '../../auth-api';
import { homeUrl } from '../../navigation';
import './style.css';
import { Dashboard } from './dashboard';
import type { LoginResult } from '@zap/api-client';

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);
const { signIn, signUp } = createAuthActions(apiUrl);

function Application() {
  const [session,setSession]=useState<LoginResult>();
  const authenticate=async(input:{phone:string;password:string})=>{const result=await signIn(input);setSession(result);return result;};
  return <Authentication portal="professional" onLogin={authenticate} onRegister={async input=>{const result=await signUp(input);setSession(result);return result;}} homeHref={homeUrl()} renderAuthenticated={signOut=>session && <Dashboard apiUrl={apiUrl} token={session.token} userId={session.user.id} userName={session.user.name} onLogout={()=>{setSession(undefined);signOut();}} />} />;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Application /></StrictMode>);
