import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DriverIcon } from './driver-icons';
import { DriverMap } from './driver-map';

type Coordinates = { latitude: number; longitude: number } | null;
export function DriverOnline({ name, connected, location, onStop, onLogout, children }: { name: string; connected: boolean; location: Coordinates; onStop: () => void; onLogout: () => void; children?: ReactNode }) {
  const [confirmStop, setConfirmStop] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const previousConnection = useRef(connected);
  const [connectionNotice, setConnectionNotice] = useState<'offline' | 'online' | null>(connected ? null : 'offline');
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part=>part[0]).join('').toUpperCase() || 'MT';
  useEffect(() => { if (!confirmStop) return; const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setConfirmStop(false); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [confirmStop]);
  useEffect(() => {
    if (!connected) setConnectionNotice('offline');
    else if (!previousConnection.current) {
      setConnectionNotice('online');
      const timeout = window.setTimeout(() => setConnectionNotice(null), 2500);
      previousConnection.current = connected;
      return () => window.clearTimeout(timeout);
    }
    previousConnection.current = connected;
  }, [connected]);
  return <div className="driver-online"><header className="driver-online__header"><div className="driver-online__brand"><span className="driver-online__logo"><DriverIcon name="package"/></span><div><span>ENCOMENDAS<span>ZAP</span></span><small>Área do motorista</small></div></div><div className="driver-account"><button type="button" className="driver-avatar driver-avatar--small" onClick={()=>setAccountOpen(!accountOpen)} aria-label="Abrir menu da conta" aria-expanded={accountOpen}>{initials}</button>{accountOpen && <div className="driver-account__menu"><strong>{name}</strong><span>Motorista</span><button type="button" onClick={onLogout}><DriverIcon name="logout" size={16}/> Sair da conta</button></div>}</div></header>
    {connectionNotice && <div className={`driver-connection driver-connection--${connectionNotice}`} role="status"><DriverIcon name={connectionNotice === 'offline' ? 'wifi-off' : 'wifi'} size={17}/>{connectionNotice === 'offline' ? 'Offline' : 'Online'}</div>}
    <DriverMap location={location}/>
    <main className="driver-online__main">{children}</main>
    <footer className="driver-online__footer"><div><strong>Pronto para receber</strong><span>As chamadas aparecerão nesta tela</span></div><button type="button" onClick={()=>setConfirmStop(true)} aria-label="Sair de serviço"><DriverIcon name="power" size={22}/></button></footer>
    {confirmStop && <div className="driver-dialog-backdrop" onClick={()=>setConfirmStop(false)}><section className="driver-dialog" role="dialog" aria-modal="true" aria-labelledby="driver-dialog-title" onClick={event=>event.stopPropagation()}><div className="driver-dialog__icon"><DriverIcon name="power" size={22}/></div><h2 id="driver-dialog-title">Finalizar serviço?</h2><p>Ao sair de serviço, a localização será pausada e você deixará de receber chamadas.</p><div><button type="button" onClick={()=>setConfirmStop(false)}>Continuar online</button><button type="button" onClick={()=>{setConfirmStop(false);onStop();}}>Sim, sair de serviço</button></div></section></div>}
  </div>;
}
