import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

type Entity = { id: string; name: string };
type Driver = Entity & { onDuty: boolean; online: boolean };
type Call = { id: string; companyId: string; status: 'pending' | 'accepted' | 'rejected' | 'expired' };
type Result = { ok: boolean; error?: string; data?: unknown };
const labels = { pending: 'Aguardando resposta', accepted: 'Chamada aceita', rejected: 'Chamada recusada', expired: 'Chamada expirada' };

export function CompanyDashboard({ apiUrl, token, name, onSignOut }: { apiUrl: string; token: string; name: string; onSignOut: () => void }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [companies, setCompanies] = useState<Entity[]>([]);
  const [company, setCompany] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driver, setDriver] = useState('');
  const [call, setCall] = useState<Call | null>(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const client = io(apiUrl, { auth: { token } });
    setSocket(client);
    client.on('connect', () => { setConnected(true); setError(''); client.emit('companies:list', (result: Result) => { if (result.ok) setCompanies(result.data as Entity[]); else setError(result.error || 'Não foi possível carregar as transportadoras.'); }); });
    client.on('disconnect', () => setConnected(false));
    client.on('connect_error', () => { setConnected(false); setError('Não foi possível conectar às chamadas. Tente novamente.'); });
    client.on('test-call:updated', (next: Call) => setCall(current => current?.id === next.id ? next : current));
    client.on('professional:status', (status: { professionalId: string; onDuty: boolean; online: boolean }) => setDrivers(current => current.map(item => item.id === status.professionalId ? { ...item, onDuty: status.onDuty, online: status.online } : item)));
    return () => { client.disconnect(); setSocket(null); };
  }, [apiUrl, token]);
  useEffect(() => {
    if (!socket || !connected || !company) return;
    setDrivers([]); setDriver('');
    socket.emit('company:subscribe', company, (result: Result) => { if (result.ok) { setDrivers(result.data as Driver[]); setError(''); } else setError(result.error || 'Não foi possível carregar os motoristas.'); });
  }, [socket, connected, company]);
  useEffect(() => {
    if (!socket || !connected || !call || call.status !== 'pending') return;
    socket.emit('test-call:status', { id: call.id, companyId: call.companyId }, (result: Result) => { if (result.ok) setCall(result.data as Call); });
  }, [socket, connected, call?.id]);
  function createCall() {
    if (!socket || !company || !driver) return;
    setError('');
    socket.timeout(10000).emit('test-call:create', { companyId: company, professionalId: driver }, (failure: Error | null, result: Result) => {
      if (failure) { setError('Não foi possível confirmar a chamada. Confira sua conexão antes de tentar novamente.'); return; }
      if (!result.ok) { setError(result.error || 'Não foi possível criar a chamada.'); return; }
      setCall(result.data as Call);
    });
  }
  return <main className="operation-page"><section className="operation-card"><header><p>Transportadora</p><h1>Olá, {name}</h1><button type="button" onClick={onSignOut}>Sair</button></header><p>{connected ? 'Conectado' : 'Reconectando...'}</p><h2>Testar chamada de coleta</h2><p>Envie uma chamada de teste para um motorista vinculado. Nenhum pedido real será criado.</p>
    <label>Transportadora<select value={company} onChange={event => setCompany(event.target.value)}><option value="">Selecione</option>{companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {!companies.length && connected && <p>Não há transportadora vinculada à sua conta.</p>}
    <label>Motorista<select value={driver} onChange={event => setDriver(event.target.value)}><option value="">Selecione</option>{drivers.map(item => <option key={item.id} value={item.id}>{item.name} — {item.onDuty && item.online ? 'em serviço' : 'indisponível'}</option>)}</select></label>
    <button className="primary-button" type="button" onClick={createCall} disabled={!connected || !driver || call?.status === 'pending'}>Testar chamada</button>
    {call && <p role="status">{labels[call.status]}</p>}{error && <p role="alert">{error}</p>}
  </section></main>;
}
