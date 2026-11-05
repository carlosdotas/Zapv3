import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { DriverOffline } from './driver-offline';
import { DriverOnline } from './driver-online';
import { DriverCall, type PickupCall } from './driver-call';
import { usePickupSound } from './pickup-sound';
import { isPickupForProfessional } from './pickup-target';

type Coordinates = { latitude: number; longitude: number; updatedAt: number } | null;
type Native = { startDuty:(token:string)=>void; stopLocation:()=>void; isLocationRunning:()=>boolean; canShowUrgentCalls?:()=>boolean; openUrgentCallSettings?:()=>void; getLatitude?:()=>number; getLongitude?:()=>number; getLocationUpdatedAt?:()=>number };

export function Dashboard({ apiUrl, token, userId, userName, onLogout }: { apiUrl:string; token:string; userId:string; userName:string; onLogout:()=>void }) {
  const native = (window as unknown as {AndroidApp?:Native}).AndroidApp;
  const [socket, setSocket] = useState<Socket>();
  const [connected, setConnected] = useState(false);
  const [duty, setDuty] = useState(()=>native?.isLocationRunning() ?? false);
  const [location, setLocation] = useState<Coordinates>(null);
  const [calls, setCalls] = useState<PickupCall[]>([]);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [urgentAccess, setUrgentAccess] = useState<'allowed'|'denied'|'update'>('allowed');
  const pending = calls.filter(call=>isPickupForProfessional(call,userId) && call.status==='pending' && Date.parse(call.expiresAt)>now);
  const enableSound = usePickupSound(pending.length>0, Boolean(native));

  useEffect(()=>{
    const client=io(apiUrl,{auth:{token}}); setSocket(client);
    client.on('connect',()=>{setConnected(true);setMessage('');client.emit('pickup:sync',{},(result:{data?:PickupCall[]})=>{if(result.data){setNow(Date.now());setCalls(result.data);}});});
    client.on('disconnect',()=>setConnected(false));
    client.on('connect_error',()=>{setConnected(false);setMessage('Sem conexão. Tentando reconectar.');});
    client.on('pickup:updated',(call:PickupCall)=>{setNow(Date.now());setCalls(old=>[call,...old.filter(item=>item.id!==call.id)]);});
    const timer=window.setInterval(()=>setNow(Date.now()),1000);
    return ()=>{window.clearInterval(timer);client.disconnect();};
  },[apiUrl,token]);

  useEffect(()=>{
    if(!native)return;
    const update=()=>{try{const running=native.isLocationRunning();setDuty(running);const timestamp=native.getLocationUpdatedAt?.() ?? 0;const latitude=native.getLatitude?.();const longitude=native.getLongitude?.();if(running && timestamp>0 && Date.now()-timestamp<120000 && typeof latitude==='number' && typeof longitude==='number' && Number.isFinite(latitude) && Number.isFinite(longitude))setLocation({latitude,longitude,updatedAt:timestamp});else setLocation(null);}catch{setLocation(null);}};
    update();const timer=window.setInterval(update,1500);return()=>window.clearInterval(timer);
  },[native]);

  useEffect(()=>{
    if(!native)return;
    const check=()=>{try{setUrgentAccess(typeof native.canShowUrgentCalls!=='function'?'update':native.canShowUrgentCalls()?'allowed':'denied');}catch{setUrgentAccess('denied');}};
    check();window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
    return()=>{window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
  },[native]);

  useEffect(()=>{
    if(!duty || native){if(!duty)setLocation(null);return;}
    let watch:number|undefined;let lastSent=0;
    const beat=window.setInterval(()=>{if(socket?.connected)socket.emit('presence:heartbeat',{},()=>{});},30000);
    if(navigator.geolocation)watch=navigator.geolocation.watchPosition(position=>{
      setLocation({latitude:position.coords.latitude,longitude:position.coords.longitude,updatedAt:position.timestamp});
      if(!socket?.connected || Date.now()-lastSent<10000)return;
      lastSent=Date.now();socket.emit('location:update',{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,recordedAt:new Date(position.timestamp).toISOString()},()=>{});
    },()=>{setLocation(null);setMessage('Confira a permissão e o sinal de localização.');},{enableHighAccuracy:true,maximumAge:10000});
    return()=>{window.clearInterval(beat);if(watch!==undefined)navigator.geolocation.clearWatch(watch);};
  },[duty,native,socket]);

  function changeDuty(on:boolean) {
    if(on)enableSound();
    if(native){if(on)native.startDuty(token);else native.stopLocation();setDuty(on);setMessage(on?'Confira a notificação de serviço e as permissões do Android.':'Fora de serviço.');return;}
    if(!on){setDuty(false);setLocation(null);}
    if(!socket?.connected){setMessage('Sem conexão. Aguarde a reconexão para alterar seu serviço.');return;}
    socket.emit('duty:set',{onDuty:on},(result:{error?:string})=>{if(result.error)setMessage(result.error);else{setDuty(on);setMessage('');}});
  }
  function answer(id:string, choice:'accepted'|'rejected'):Promise<string|undefined> {
    if(!socket?.connected)return Promise.resolve('Sem conexão. Aguarde e tente novamente.');
    return new Promise(resolve=>socket.timeout(10000).emit('pickup:respond',{id,answer:choice},(failure:Error|null,result?:{data?:PickupCall;error?:string})=>{
      if(failure || !result?.data){resolve(result?.error || 'Não foi possível confirmar a resposta. Tente novamente.');return;}
      setCalls(old=>[result.data!,...old.filter(item=>item.id!==result.data!.id)]);resolve(undefined);
    }));
  }
  function logout(){if(!native)changeDuty(false);onLogout();}
  const notice=<>
    {urgentAccess==='denied' && <div className="driver-notice"><strong>Ative as chamadas em tela cheia</strong><p>Permita a exibição sobre a tela bloqueada nas configurações do Android.</p><button type="button" onClick={()=>native?.openUrgentCallSettings?.()}>Abrir configurações</button></div>}
    {urgentAccess==='update' && <div className="driver-notice"><p>Atualize o aplicativo do motorista para receber chamadas em tela cheia.</p></div>}
    {message && <p className="driver-status-message" role="status">{message}</p>}
    {!native && duty && <p className="driver-browser-note">No navegador, localização e avisos em segundo plano dependem do sistema. Use o aplicativo Android durante o serviço.</p>}
  </>;
  return <div className="driver-app">{duty ? <DriverOnline name={userName} connected={connected} location={location && now-location.updatedAt<120000 ? location : null} onStop={()=>changeDuty(false)} onLogout={logout}>{notice}</DriverOnline> : <DriverOffline name={userName} disabled={!native && !connected} onStart={()=>changeDuty(true)} onLogout={logout}>{notice}</DriverOffline>}
    {pending.length>0 && <div className="incoming-layer">{pending.map(call=><DriverCall key={call.id} call={call} now={now} onAnswer={answer}/>)}</div>}
  </div>;
}
