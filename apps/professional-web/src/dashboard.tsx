import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { usePickupSound } from './pickup-sound';
import { isPickupForProfessional } from './pickup-target';
type Call={id:string;professionalId:string;status:string;expiresAt:string};
type Native={startDuty:(token:string)=>void;stopLocation:()=>void;isLocationRunning:()=>boolean;canShowUrgentCalls?:()=>boolean;openUrgentCallSettings?:()=>void};
export function Dashboard({apiUrl,token,userId,onLogout}:{apiUrl:string;token:string;userId:string;onLogout:()=>void}) {
  const native=(window as unknown as {AndroidApp?:Native}).AndroidApp;
  const [socket,setSocket]=useState<Socket>();const [duty,setDuty]=useState(()=>native?.isLocationRunning()??false); const [calls,setCalls]=useState<Call[]>([]); const [message,setMessage]=useState('');const [now,setNow]=useState(Date.now());
  const [urgentAccess,setUrgentAccess]=useState<'allowed'|'denied'|'update'>('allowed');
  const pending=calls.filter(c=>isPickupForProfessional(c,userId)&&c.status==='pending'&&Date.parse(c.expiresAt)>now);
  const enableSound=usePickupSound(pending.length>0);
  useEffect(()=>{const s=io(apiUrl,{auth:{token}});setSocket(s);s.on('connect',()=>s.emit('pickup:sync',{},(r:any)=>{if(r.data)setCalls(r.data);}));s.on('connect_error',()=>setMessage('Sem conexão. Tentando reconectar.'));
    s.on('pickup:updated',(call:Call)=>setCalls(old=>[call,...old.filter(c=>c.id!==call.id)]));const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{clearInterval(timer);s.disconnect();};},[apiUrl,token]);
  useEffect(()=>{if(!native)return;const timer=setInterval(()=>setDuty(native.isLocationRunning()),1500);return()=>clearInterval(timer);},[native]);
  useEffect(()=>{if(!native)return;const check=()=>{try{setUrgentAccess(typeof native.canShowUrgentCalls !== 'function'?'update':native.canShowUrgentCalls()?'allowed':'denied');}catch{setUrgentAccess('denied');}};check();window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);return()=>{window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};},[native]);
  useEffect(()=>{if(!duty||native)return;let watch:number|undefined;let lastSent=0;const beat=setInterval(()=>{if(socket?.connected)socket.emit('presence:heartbeat',{},()=>{});},30000);
    if(navigator.geolocation)watch=navigator.geolocation.watchPosition(p=>{if(!socket?.connected||Date.now()-lastSent<10000)return;lastSent=Date.now();socket.emit('location:update',{latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,recordedAt:new Date(p.timestamp).toISOString()},()=>{});},()=>setMessage('Confira a permissão e o sinal de localização.'),{enableHighAccuracy:true,maximumAge:10000});
    return()=>{clearInterval(beat);if(watch!==undefined)navigator.geolocation.clearWatch(watch);};},[duty,native,socket]);
  function changeDuty(on:boolean) {if(on)enableSound();if(native){if(on)native.startDuty(token);else native.stopLocation();setDuty(on);setMessage(on?'Confira a notificação de serviço e as permissões do Android.':'Fora de serviço.');return;}
    socket?.emit('duty:set',{onDuty:on},(r:any)=>{if(r.error)setMessage(r.error);else setDuty(on);});}
  return <main className="success-panel driver-dashboard"><h1>Área do motorista</h1><button className={duty?'driver-button driver-button--off':'driver-button driver-button--on'} onClick={()=>changeDuty(!duty)}>{duty?'Sair de serviço':'Entrar em serviço'}</button>
    <p>Ao entrar em serviço, você autoriza o compartilhamento da sua localização com a central.</p>{!native&&<p>No navegador, a localização e os avisos em segundo plano dependem do sistema. Use o aplicativo Android durante o serviço.</p>}
    {urgentAccess==='denied'&&<div className="driver-call"><p>Para exibir chamadas urgentes com a tela bloqueada, permita chamadas em tela cheia nas configurações do Android.</p><button className="driver-button driver-button--on" onClick={()=>native?.openUrgentCallSettings?.()}>Permitir chamadas em tela cheia</button></div>}
    {urgentAccess==='update'&&<div className="driver-call"><p>Para receber a tela de chamada urgente, atualize o aplicativo do motorista na página inicial.</p></div>}
    <p role="status">{message}</p>{pending.map(c=><section className="driver-call" key={c.id} role="alert"><h2>Chamada de coleta — teste</h2><p>Responda em {Math.max(0,Math.ceil((Date.parse(c.expiresAt)-now)/1000))} segundos.</p><div className="driver-call__actions">{(['accepted','rejected'] as const).map(answer=><button className={`driver-button driver-button--${answer}`} key={answer} onClick={()=>socket?.emit('pickup:respond',{id:c.id,answer},(r:any)=>{if(r.error)setMessage(r.error);})}>{answer==='accepted'?'Aceitar':'Recusar'}</button>)}</div></section>)}
    <button className="driver-button driver-button--logout" onClick={()=>{changeDuty(false);onLogout();}}>Sair da conta</button>
  </main>;
}
