import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brand, Icon, MapBackdrop } from '@zap/ui';
import { io, type Socket } from 'socket.io-client';

type User = { id: string; name: string; roles: string[] };
type Company = { id: string; name: string };
type Driver = { id: string; name: string; phone: string; online: number | boolean | null };
type Call = { id: string; companyId: string; professionalId: string; status: string; expiresAt: string };
type Reply<T> = { data?: T; error?: string };
type SelfTest = { companyId: string; professionalId: string; phone: string };

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}
function formatPhone(value: string) {
  const digits = phoneDigits(value).slice(0, 11);
  if (digits.length < 3) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const split = digits.length > 10 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}
const labels: Record<string, string> = { pending: 'Aguardando resposta', accepted: 'Chamada aceita', rejected: 'Chamada recusada', expired: 'Chamada expirada' };

export function Dashboard({ apiUrl, token, user, onLogout }: { apiUrl: string; token: string; user: User; onLogout: () => void }) {
  const [socket, setSocket] = useState<Socket>();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverId, setDriverId] = useState('');
  const [phone, setPhone] = useState('');
  const [calls, setCalls] = useState<Call[]>([]);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const companyRef = useRef('');
  const canSetup = user.roles.includes('platform_admin') && user.roles.includes('professional');

  const refreshDrivers = useCallback((client: Socket, selectedCompany: string) => {
    if (!client.connected || !selectedCompany) return;
    setRefreshing(true);
    client.timeout(10000).emit('professional:list', { companyId: selectedCompany }, (failure: Error | null, result?: Reply<Driver[]>) => {
      if (companyRef.current !== selectedCompany) return;
      setRefreshing(false);
      if (failure || result?.error || !result?.data) { setMessage(result?.error || 'Não foi possível atualizar os motoristas.'); return; }
      setDrivers(result.data);
    });
  }, []);

  useEffect(() => {
    const client = io(apiUrl, { auth: { token } });
    setSocket(client);
    client.on('connect', () => {
      setConnected(true); setMessage('');
      client.emit('company:list', {}, (result: Reply<Company[]>) => {
        if (result.error || !result.data) { setMessage(result.error || 'Não foi possível carregar as transportadoras.'); return; }
        setCompanies(result.data);
        setCompanyId(current => current && result.data!.some(company => company.id === current) ? current : result.data!.length === 1 ? result.data![0].id : '');
      });
      client.emit('pickup:sync', {}, (result: Reply<Call[]>) => { if (result.data) setCalls(result.data); });
    });
    client.on('disconnect', () => setConnected(false));
    client.on('connect_error', () => { setConnected(false); setMessage('Conexão indisponível. Tentando reconectar.'); });
    client.on('pickup:updated', (call: Call) => setCalls(current => [call, ...current.filter(item => item.id !== call.id)].slice(0, 100)));
    return () => { client.disconnect(); };
  }, [apiUrl, token]);

  useEffect(() => {
    companyRef.current = companyId;
    if (!socket || !companyId || !connected) return;
    refreshDrivers(socket, companyId);
    const timer = window.setInterval(() => refreshDrivers(socket, companyId), 10000);
    return () => window.clearInterval(timer);
  }, [socket, companyId, connected, refreshDrivers]);

  const matchingDrivers = useMemo(() => {
    const search = phoneDigits(phone);
    return search ? drivers.filter(driver => phoneDigits(driver.phone).includes(search)) : drivers;
  }, [drivers, phone]);
  const selected = matchingDrivers.find(driver => driver.id === driverId);
  const currentCalls = calls.filter(call => call.companyId === companyId);

  function updatePhone(value: string) {
    const formatted = formatPhone(value);
    setPhone(formatted);
    const digits = phoneDigits(formatted);
    const exact = drivers.filter(driver => digits.length >= 10 && phoneDigits(driver.phone) === digits);
    setDriverId(exact.length === 1 ? exact[0].id : '');
  }

  function setupSelfTest() {
    if (!socket?.connected || busy) return;
    setBusy(true); setMessage('');
    socket.timeout(10000).emit('pickup:setup-self-test', {}, (failure: Error | null, result?: Reply<SelfTest>) => {
      setBusy(false);
      if (failure || result?.error || !result?.data) { setMessage(result?.error || 'Não foi possível preparar o teste. Tente novamente.'); return; }
      const setup = result.data;
      setCompanies(current => current.some(company => company.id === setup.companyId) ? current : [...current, { id: setup.companyId, name: 'Transportadora de teste' }]);
      companyRef.current = setup.companyId;
      setDrivers([]); setCompanyId(setup.companyId); setPhone(formatPhone(setup.phone)); setDriverId(setup.professionalId);
      refreshDrivers(socket, setup.companyId);
      setMessage('Teste preparado. Abra o aplicativo do motorista com este número e toque em “Entrar em serviço”.');
    });
  }

  function sendCall() {
    if (!socket?.connected || !companyId || !selected || !selected.online || busy) return;
    setBusy(true); setMessage('');
    socket.timeout(10000).emit('pickup:create', { companyId, professionalId: selected.id }, (failure: Error | null, result?: Reply<Call>) => {
      setBusy(false);
      if (failure || result?.error || !result?.data) { setMessage(result?.error || 'Não foi possível confirmar o envio. Confira o histórico antes de tentar novamente.'); return; }
      setCalls(current => [result.data!, ...current.filter(call => call.id !== result.data!.id)].slice(0, 100));
      setMessage('Chamada enviada! O motorista tem até 2 minutos para responder.');
    });
  }

  return <div className="company-page">
    <MapBackdrop />
    <header className="company-header"><Brand compact /><button type="button" onClick={onLogout}>Sair da conta</button></header>
    <main className="company-main">
      <section className="company-card" aria-labelledby="company-title">
        <div className="company-card__heading"><div><span className="company-eyebrow">Área da transportadora</span><h1 id="company-title">Chamar motorista</h1><p>Envie uma chamada de teste para o aplicativo do motorista.</p></div><span className={`company-connection${connected ? ' company-connection--online' : ''}`}><span />{connected ? 'Conectado' : 'Reconectando'}</span></div>
        <div className="company-instructions"><strong>Como funciona</strong><p>O motorista entra em serviço no aplicativo. Depois, selecione o telefone e envie a chamada. Ela não cria uma coleta real.</p></div>

        {canSetup && <div className="company-self-test"><div><strong>Quer testar no seu próprio telefone?</strong><p>Prepare uma transportadora de teste e vincule sua conta de motorista. Nenhum pedido será criado.</p></div><button type="button" onClick={setupSelfTest} disabled={!connected || busy}>Usar meu número para teste</button></div>}

        <label className="company-field">Transportadora<select value={companyId} onChange={event => { companyRef.current = event.target.value; setCompanyId(event.target.value); setRefreshing(false); setDrivers([]); setDriverId(''); setPhone(''); }}><option value="">Selecione a transportadora</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        {!companies.length && connected && <p className="company-hint">Nenhuma transportadora disponível. {canSetup ? 'Use seu número para preparar um teste.' : 'Peça à administração para vincular sua conta.'}</p>}

        <label className="company-field">Telefone do motorista<input type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={event => updatePhone(event.target.value)} placeholder="(62) 99999-9999" disabled={!companyId} /></label>
        <p className="company-hint">Digite o telefone de um motorista já vinculado à transportadora ou escolha na lista.</p>
        <label className="company-field">Motorista<select value={selected?.id || ''} onChange={event => { const chosen = drivers.find(driver => driver.id === event.target.value); setDriverId(event.target.value); if (chosen) setPhone(formatPhone(chosen.phone)); }} disabled={!companyId}><option value="">Selecione o motorista</option>{matchingDrivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} — {formatPhone(driver.phone)} — {driver.online ? 'em serviço' : 'fora de serviço'}</option>)}</select></label>
        {phone && companyId && !matchingDrivers.length && <p className="company-hint">Nenhum motorista vinculado encontrado com esse telefone.</p>}
        {selected && <div className={`company-driver-status${selected.online ? ' company-driver-status--online' : ''}`}><span />{selected.online ? 'Motorista em serviço, pronto para receber.' : 'Motorista fora de serviço. Peça para abrir o aplicativo e entrar em serviço.'}</div>}
        <button className="company-refresh" type="button" onClick={() => socket && refreshDrivers(socket, companyId)} disabled={!connected || !companyId || refreshing}>{refreshing ? 'Atualizando...' : 'Atualizar disponibilidade'}</button>
        <button className="primary-button company-send" type="button" onClick={sendCall} disabled={!connected || !companyId || !selected || !selected.online || busy}><Icon name="phone" size={18} />{busy ? 'Aguarde...' : 'Enviar chamada de teste'}</button>
        {message && <p className="company-message" role="status">{message}</p>}

        <div className="company-history"><h2>Últimas chamadas</h2>{currentCalls.length ? <ul>{currentCalls.map(call => <li key={call.id}><span>{labels[call.status] || 'Atualização da chamada'}</span><small>{new Date(call.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></li>)}</ul> : <p>Suas chamadas de teste aparecerão aqui.</p>}</div>
      </section>
    </main>
  </div>;
}
