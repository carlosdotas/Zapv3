import { useEffect, useState, type ReactNode } from 'react';
import { Authentication, AuthShell } from '@zap/ui';
import { getMe, logoutSession, type LoginResult } from '@zap/api-client';
import { createAuthActions } from './auth-api';

type Portal = 'admin'|'company'|'professional';
type Props = { portal:Portal; apiUrl:string; homeHref:string; registerHref?:string; children:(session:LoginResult,logout:()=>void)=>ReactNode };

function readToken(key:string) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function saveToken(key:string, token:string) { try { localStorage.setItem(key,token); return true; } catch { return false; } }
function removeToken(key:string) { try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ } }
function stopNativeDuty(force=false) {
  const native=(window as unknown as {AndroidApp?:{isLocationRunning?:()=>boolean;stopLocation?:()=>void}}).AndroidApp;
  try { if(force || native?.isLocationRunning?.())native?.stopLocation?.(); } catch { /* Server logout also ends the duty. */ }
}

export function SessionGate({portal,apiUrl,homeHref,registerHref,children}:Props) {
  const key=`zap.session.${portal}`;
  const [restoreToken,setRestoreToken]=useState(()=>readToken(key));
  const [phase,setPhase]=useState<'loading'|'login'|'ready'|'unavailable'>(()=>restoreToken?'loading':'login');
  const [session,setSession]=useState<LoginResult>();
  const [attempt,setAttempt]=useState(0);
  const [warning,setWarning]=useState('');
  const [busy,setBusy]=useState(false);
  const {signIn,signUp}=createAuthActions(apiUrl);

  useEffect(()=>{
    if(!restoreToken)return;
    let active=true;setPhase('loading');
    void getMe(apiUrl,restoreToken).then(result=>{if(active){setSession({token:restoreToken,user:result.user});setPhase('ready');}}).catch(error=>{
      if(!active)return;
      if(error instanceof Error && error.message==='SESSION_INVALID'){if(portal==='professional')stopNativeDuty(true);removeToken(key);setRestoreToken('');setPhase('login');setWarning('Sua sessão não está mais disponível. Entre novamente.');}
      else setPhase('unavailable');
    });
    return()=>{active=false;};
  },[apiUrl,restoreToken,attempt,key,portal]);

  useEffect(()=>{if(portal==='professional' && phase==='login' && !session && !restoreToken)stopNativeDuty();},[portal,phase,session,restoreToken]);
  useEffect(()=>{if(phase!=='unavailable')return;const retry=()=>setAttempt(value=>value+1);window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry);},[phase]);

  async function authenticate(input:{phone:string;password:string},register=false,name='') {
    const result=register ? await signUp({...input,name}) : await signIn(input);
    const persisted=saveToken(key,result.token);
    setRestoreToken('');setSession(result);setPhase('ready');
    setWarning(persisted?'':'Não foi possível salvar o acesso neste aparelho. Verifique as configurações de armazenamento.');
    return result;
  }
  async function logout() {
    if(busy)return;
    if(portal==='professional')stopNativeDuty(true);
    const token=session?.token || restoreToken;
    if(!token){removeToken(key);setSession(undefined);setPhase('login');return;}
    setBusy(true);setWarning('');
    try { await logoutSession(apiUrl,token,portal);removeToken(key);setRestoreToken('');setSession(undefined);setPhase('login'); }
    catch { setWarning('Não foi possível confirmar a saída. Confira a conexão e tente sair da conta novamente.'); }
    finally { setBusy(false); }
  }
  const alert=warning && <div role="alert" style={{position:'fixed',zIndex:100,top:12,left:12,right:12,margin:'auto',maxWidth:480,padding:'12px 14px',borderRadius:10,background:'#fff7ed',color:'#9a3412',boxShadow:'0 6px 24px #0003',fontSize:13,fontWeight:700}}>{warning} <button type="button" onClick={()=>setWarning('')} aria-label="Fechar aviso" style={{float:'right',border:0,background:'none',color:'inherit',fontSize:18}}>×</button></div>;
  if(phase==='loading' || phase==='unavailable')return <>{alert}<AuthShell description="Acesso à sua conta" portal="EncomendasZap" homeHref={homeHref}><section className="success-panel" aria-live="polite"><h2>{phase==='loading'?'Restaurando seu acesso...':'Não foi possível conectar'}</h2><p>{phase==='loading'?'Aguarde um instante.':'Seu acesso continua salvo. Confira sua internet e tente novamente.'}</p>{phase==='unavailable' && <><button type="button" className="primary-button" onClick={()=>setAttempt(value=>value+1)}>Tentar novamente</button><button type="button" className="auth-home-link" disabled={busy} onClick={()=>void logout()}>Sair da conta</button></>}</section></AuthShell></>;
  if(phase==='ready' && session)return <>{alert}{children(session,()=>void logout())}</>;
  return <>{alert}<Authentication portal={portal} onLogin={input=>authenticate(input)} onRegister={portal==='professional'?input=>authenticate(input,true,input.name):undefined} registerHref={registerHref} homeHref={homeHref}/></>;
}
