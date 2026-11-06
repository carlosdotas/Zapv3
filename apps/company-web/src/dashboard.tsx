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
  const [pickupName, setPickupName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLocation, setPickupLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [calls, setCalls] = useState<Call[]>([]);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmLink, setConfirmLink] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const companyRef = useRef('');
  const driversRequest = useRef(0);
  const lastDriversRefresh = useRef<{ company: string; at: number }>({ company: '', at: 0 });
  const locationRequest = useRef(0);
  const canSetup = user.roles.includes('platform_admin') && user.roles.includes('professional');

  const refreshDrivers = useCallback((client: Socket, selectedCompany: string) => {
    if (!client.connected || !selectedCompany) return;
    const now = Date.now();
    if (lastDriversRefresh.current.company === selectedCompany && now - lastDriversRefresh.current.at < 500) return;
    lastDriversRefresh.current = { company: selectedCompany, at: now };
    const request = ++driversRequest.current;
    setRefreshing(true);
    client.timeout(10000).emit('professional:list', { companyId: selectedCompany }, (failure: Error | null, result?: Reply<Driver[]>) => {
      if (companyRef.current !== selectedCompany || request !== driversRequest.current) return;
      setRefreshing(false);
      if (failure || result?.error || !result?.data) { setDrivers([]); setMessage(result?.error || 'Não foi possível atualizar os motoristas.'); return; }
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
    client.on('disconnect', () => { driversRequest.current++; lastDriversRefresh.current = { company: '', at: 0 }; setConnected(false); setDrivers([]); setRefreshing(false); });
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
    return drivers.filter(driver => Boolean(driver.online) && (!search || phoneDigits(driver.phone).includes(search)));
  }, [drivers, phone]);
  const selected = matchingDrivers.find(driver => driver.id === driverId);
  const currentCalls = calls.filter(call => call.companyId === companyId);

  useEffect(() => {
    const digits = phoneDigits(phone);
    if (digits.length < 10) return;
    const exact = drivers.filter(driver => driver.online && phoneDigits(driver.phone) === digits);
    if (exact.length === 1) setDriverId(exact[0].id);
  }, [drivers, phone]);

  function updatePhone(value: string) {
    setConfirmLink(false);
    const formatted = formatPhone(value);
    setPhone(formatted);
    const digits = phoneDigits(formatted);
    const exact = drivers.filter(driver => driver.online && digits.length >= 10 && phoneDigits(driver.phone) === digits);
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

  function linkDriver() {
    const digits = phoneDigits(phone);
    if (!socket?.connected || !companyId || busy || digits.length < 10 || digits.length > 11) return;
    setConfirmLink(false); setBusy(true); setMessage('');
    socket.timeout(10000).emit('professional:link', { companyId, phone: `+55${digits}` }, (failure: Error | null, result?: Reply<{ linked: boolean }>) => {
      setBusy(false);
      if (failure || result?.error || !result?.data?.linked) { setMessage(result?.error || 'Não foi possível confirmar o vínculo. Atualize a lista antes de tentar novamente.'); return; }
      setMessage('Motorista autorizado. Ele aparecerá na lista quando entrar em serviço.');
      lastDriversRefresh.current = { company: '', at: 0 };
      refreshDrivers(socket, companyId);
    });
  }

  function sendCall() {
    if (!socket?.connected || !companyId || !selected || !selected.online || busy || !pickupName.trim() || !pickupAddress.trim()) return;
    setBusy(true); setMessage('');
    socket.timeout(10000).emit('pickup:create', { companyId, professionalId: selected.id, details: { pickupName, pickupAddress, ...(pickupLocation ?? {}) } }, (failure: Error | null, result?: Reply<Call>) => {
      setBusy(false);
      if (failure || result?.error || !result?.data) { setMessage(result?.error || 'Não foi possível confirmar o envio. Confira o histórico antes de tentar novamente.'); return; }
      setCalls(current => [result.data!, ...current.filter(call => call.id !== result.data!.id)].slice(0, 100));
      setMessage('Chamada enviada! O motorista tem até 2 minutos para responder.');
    });
  }

  function locatePickup() {
    if (!navigator.geolocation) { setMessage('A localização não está disponível neste aparelho.'); return; }
    const request = ++locationRequest.current;
    setLocating(true); setMessage(''); setPickupLocation(null);
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      setLocating(false);
      if (position.coords.accuracy > 150) { setMessage('Localização imprecisa. Tente novamente em um local aberto.'); return; }
      setPickupLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setMessage('Localização da coleta registrada para calcular a distância aproximada.');
    }, () => { if (request === locationRequest.current) { setLocating(false); setMessage('Não foi possível obter a localização. Você ainda pode enviar a chamada sem distância.'); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
  }

  return <div className="company-page">
    <MapBackdrop />
    <header className="company-header"><Brand compact /><button type="button" onClick={onLogout}>Sair da conta</button></header>
    <main className="company-main">
      <section className="company-card" aria-labelledby="company-title">
        <div className="company-card__heading"><div><span className="company-eyebrow">Área da transportadora</span><h1 id="company-title">Chamar motorista</h1><p>Envie uma chamada de teste para o aplicativo do motorista.</p></div><span className={`company-connection${connected ? ' company-connection--online' : ''}`}><span />{connected ? 'Conectado' : 'Reconectando'}</span></div>
        <div className="company-instructions"><strong>Como funciona</strong><p>O motorista entra em serviço no aplicativo. Depois, selecione o telefone e envie a chamada. Ela não cria uma coleta real.</p></div>

        {canSetup && <div className="company-self-test"><div><strong>Quer testar no seu próprio telefone?</strong><p>Prepare uma transportadora de teste e vincule sua conta de motorista. Nenhum pedido será criado.</p></div><button type="button" onClick={setupSelfTest} disabled={!connected || busy}>Usar meu número para teste</button></div>}

        <label className="company-field">Transportadora<select value={companyId} disabled={busy} onChange={event => { setConfirmLink(false); driversRequest.current++; lastDriversRefresh.current = { company: '', at: 0 }; companyRef.current = event.target.value; setCompanyId(event.target.value); setRefreshing(false); setDrivers([]); setDriverId(''); setPhone(''); }}><option value="">Selecione a transportadora</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        {!companies.length && connected && <p className="company-hint">Nenhuma transportadora disponível. {canSetup ? 'Use seu número para preparar um teste.' : 'Peça à administração para vincular sua conta.'}</p>}

        <label className="company-field">Telefone do motorista<input type="tel" inputMode="tel" autoComplete="off" value={phone} onFocus={() => socket && refreshDrivers(socket, companyId)} onChange={event => updatePhone(event.target.value)} placeholder="(62) 99999-9999" disabled={!companyId} /></label>
        <p className="company-hint">Digite o telefone de um motorista em serviço vinculado à transportadora ou escolha na lista.</p>
        <button className="company-refresh" type="button" onClick={() => setConfirmLink(true)} disabled={!connected || !companyId || busy || phoneDigits(phone).length < 10}>Autorizar motorista pelo telefone</button>
        {confirmLink && <div className="company-self-test" role="group" aria-label="Confirmar autorização do motorista"><div><strong>Autorizar motorista?</strong><p>O telefone {formatPhone(phone)} será vinculado à transportadora selecionada.</p></div><div><button type="button" onClick={linkDriver} disabled={busy}>Confirmar autorização</button><button type="button" onClick={() => setConfirmLink(false)} disabled={busy}>Cancelar</button></div></div>}
        <label className="company-field">Motoristas em serviço<select value={selected?.id || ''} onFocus={() => socket && refreshDrivers(socket, companyId)} onPointerDown={() => socket && refreshDrivers(socket, companyId)} onChange={event => { const chosen = matchingDrivers.find(driver => driver.id === event.target.value); setDriverId(event.target.value); if (chosen) setPhone(formatPhone(chosen.phone)); }} disabled={!companyId || !connected}><option value="">{refreshing ? 'Atualizando motoristas...' : 'Selecione o motorista'}</option>{matchingDrivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name} — {formatPhone(driver.phone)}</option>)}</select></label>
        {companyId && connected && !refreshing && !matchingDrivers.length && <p className="company-hint">{phone ? 'Nenhum motorista em serviço encontrado com esse telefone.' : 'Nenhum motorista vinculado está em serviço no momento.'}</p>}
        {selected && <div className={`company-driver-status${selected.online ? ' company-driver-status--online' : ''}`}><span />{selected.online ? 'Motorista em serviço, pronto para receber.' : 'Motorista fora de serviço. Peça para abrir o aplicativo e entrar em serviço.'}</div>}
        <button className="company-refresh" type="button" onClick={() => socket && refreshDrivers(socket, companyId)} disabled={!connected || !companyId || refreshing}>{refreshing ? 'Buscando motoristas em serviço...' : 'Buscar motoristas em serviço'}</button>
        <label className="company-field">Nome do local da coleta<input value={pickupName} onChange={event => setPickupName(event.target.value)} maxLength={160} placeholder="Ex.: Loja Central" /></label>
        <label className="company-field">Endereço da coleta<input value={pickupAddress} onChange={event => { locationRequest.current++; setLocating(false); setPickupLocation(null); setPickupAddress(event.target.value); }} maxLength={300} placeholder="Rua, número, bairro e cidade" /></label>
        <button className="company-refresh" type="button" onClick={locatePickup} disabled={locating || !pickupAddress.trim()}>{locating ? 'Obtendo localização...' : pickupLocation ? 'Localização da coleta registrada' : 'Estou no local: usar minha localização'}</button>
        <p className="company-hint">Use a localização somente se você estiver no endereço da coleta. Sem ela ou sem GPS recente do motorista, a distância não será exibida.</p>
        <button className="primary-button company-send" type="button" onClick={sendCall} disabled={!connected || !companyId || !selected || !selected.online || refreshing || busy || !pickupName.trim() || !pickupAddress.trim()}><Icon name="phone" size={18} />{busy ? 'Aguarde...' : 'Enviar chamada de teste'}</button>
        {message && <p className="company-message" role="status">{message}</p>}

        <div className="company-history"><h2>Últimas chamadas</h2>{currentCalls.length ? <ul>{currentCalls.map(call => <li key={call.id}><span>{labels[call.status] || 'Atualização da chamada'}</span><small>{new Date(call.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></li>)}</ul> : <p>Suas chamadas de teste aparecerão aqui.</p>}</div>
      </section>
    </main>
  </div>;
}
