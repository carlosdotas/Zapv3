import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
type Call={id:string;status:string;expiresAt:string};
export function Dashboard({apiUrl,token,onLogout}:{apiUrl:string;token:string;onLogout:()=>void}) {
  const [socket,setSocket]=useState<Socket>(); const [companies,setCompanies]=useState<{id:string;name:string}[]>([]); const [companyId,setCompanyId]=useState('');
  const [professionals,setProfessionals]=useState<{id:string;name:string;online:number}[]>([]);const [professionalId,setProfessionalId]=useState('');const [calls,setCalls]=useState<Call[]>([]); const [message,setMessage]=useState('');const [connected,setConnected]=useState(false);const [busy,setBusy]=useState(false);
  useEffect(()=>{const s=io(apiUrl,{auth:{token}});setSocket(s);
    s.on('connect',()=>{setConnected(true);s.emit('company:list',{},(r:any)=>{if(r.error)setMessage(r.error);else setCompanies(r.data);});s.emit('pickup:sync',{},(r:any)=>{if(r.data)setCalls(r.data);});});
    s.on('disconnect',()=>setConnected(false));s.on('connect_error',()=>setMessage('Conexão indisponível. Tentando reconectar.'));
    s.on('pickup:updated',(call:Call)=>setCalls(old=>[call,...old.filter(c=>c.id!==call.id)].slice(0,100)));return()=>{s.disconnect();};
  },[apiUrl,token]);
  useEffect(()=>{if(!socket || !companyId)return; const refresh=()=>socket.emit('professional:list',{companyId},(r:any)=>{if(r.data)setProfessionals(r.data);else setMessage(r.error);});refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[socket,companyId]);
  const labels:Record<string,string>={pending:'Aguardando resposta',accepted:'Aceita',rejected:'Recusada',expired:'Expirada'};
  return <main className="success-panel"><h1>Central de coletas</h1><p>{connected?'Conectado':'Reconectando…'}</p>
    <label>Empresa <select value={companyId} onChange={e=>{setCompanyId(e.target.value);setProfessionalId('');setProfessionals([]);}}><option value="">Selecione</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {!companies.length&&<p>Nenhuma empresa autorizada está vinculada à sua conta.</p>}
    <label>Profissional <select value={professionalId} onChange={e=>setProfessionalId(e.target.value)}><option value="">Selecione</option>{professionals.map(p=><option key={p.id} value={p.id}>{p.name} — {p.online?'Em serviço':'Indisponível'}</option>)}</select></label>
    <button disabled={!connected||!companyId||!professionalId||busy} onClick={()=>{setBusy(true);socket?.timeout(10000).emit('pickup:create',{companyId,professionalId},(err:any,r:any)=>{setBusy(false);setMessage(err?'Sem confirmação. Confira o histórico antes de tentar novamente.':r.error||'Chamada de teste enviada. Prazo de resposta: 30 segundos.');});}}>Testar chamada</button>
    <p>Chamadas de teste não criam ordens de coleta.</p><p role="status">{message}</p>
    <ul>{calls.map(c=><li key={c.id}>{labels[c.status]} — {new Date(c.expiresAt).toLocaleTimeString('pt-BR')}</li>)}</ul><button onClick={onLogout}>Sair da conta</button>
  </main>;
}
