import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type Call = { id: string; status: 'pending' | 'accepted' | 'rejected' | 'expired'; expiresAt: string };
type Result = { ok: boolean; error?: string; data?: unknown };
export function DriverDashboard({ apiUrl, token, name, onSignOut }: { apiUrl: string; token: string; name: string; onSignOut: () => void }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [onDuty, setOnDuty] = useState(false);
  const [dutyConnected, setDutyConnected] = useState(false);
  const nativeApp = window.AndroidApp;
  useEffect(() => {
    if (!nativeApp?.isNativeApp?.()) return;
    const check = () => { setOnDuty(nativeApp.isDutyRunning?.() ?? false); setDutyConnected(nativeApp.isDutyConnected?.() ?? false); };
    check();
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [nativeApp]);
  useEffect(() => {
    const client = io(apiUrl, { auth: { token } });
    setSocket(client);
    client.on('connect', () => { setConnected(true); setError(''); client.emit('test-call:pending', (result: Result) => { if (result.ok) setCalls(result.data as Call[]); else setError(result.error || 'Não foi possível consultar chamadas.'); }); });
    client.on('disconnect', () => setConnected(false));
    client.on('connect_error', () => { setConnected(false); setError('Não foi possível conectar às chamadas. Tente novamente.'); });
    client.on('test-call:updated', (call: Call) => {
      setCalls(current => call.status === 'pending' ? [...current.filter(item => item.id !== call.id), call] : current.filter(item => item.id !== call.id));
    });
    return () => { client.disconnect(); setSocket(null); };
  }, [apiUrl, token]);
  function respond(id: string, answer: 'accepted' | 'rejected') {
    socket?.timeout(10000).emit('test-call:respond', { id, answer }, (failure: Error | null, result: Result) => {
      if (failure) { setError('Não foi possível confirmar sua resposta. Confira sua conexão.'); return; }
      if (!result.ok) { setError(result.error || 'Não foi possível responder.'); return; }
      setCalls(current => current.filter(call => call.id !== id)); setError('');
    });
  }
  function signOut() { nativeApp?.stopDuty?.(); onSignOut(); }
  return <main className="operation-page"><section className="operation-card"><header><p>Motorista</p><h1>Olá, {name}</h1><button type="button" onClick={signOut}>Sair</button></header><p>{connected ? 'Conectado' : 'Reconectando...'}</p>
    {nativeApp?.startDuty ? <><p>Ao entrar em serviço, sua localização será compartilhada durante o trabalho.</p><button className="primary-button" type="button" onClick={() => onDuty ? nativeApp.stopDuty?.() : nativeApp.startDuty?.(token)}>{onDuty ? 'Sair de serviço' : 'Entrar em serviço'}</button>{onDuty && <p role="status">{dutyConnected ? 'Em serviço e conectado.' : 'Em serviço; aguardando conexão.'}</p>}</> : <p>Para entrar em serviço e compartilhar a localização, use o aplicativo do motorista.</p>}
    <h2>Chamadas de teste</h2>
    {calls.length ? calls.map(call => <article key={call.id}><strong>Chamada de coleta de teste</strong><p>Responda antes de {new Date(call.expiresAt).toLocaleTimeString('pt-BR')}.</p><div className="call-actions"><button type="button" onClick={() => respond(call.id, 'accepted')}>Aceitar</button><button type="button" onClick={() => respond(call.id, 'rejected')}>Recusar</button></div></article>) : <p>Você não tem chamadas pendentes.</p>}
    {error && <p role="alert">{error}</p>}
  </section></main>;
}
