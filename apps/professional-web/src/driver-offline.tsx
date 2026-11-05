import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Icon } from '@zap/ui';
import { DriverIcon } from './driver-icons';

export function DriverOffline({ name, disabled, onStart, onLogout, children }: { name: string; disabled: boolean; onStart: () => void; onLogout: () => void; children?: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'MT';
  function move(event: PointerEvent<HTMLDivElement>) {
    if (start.current === null || !track.current) return;
    const amount = Math.max(0, Math.min(1, (event.clientX - start.current) / Math.max(1, track.current.clientWidth - 70)));
    progressRef.current = amount; setProgress(amount);
  }
  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    if (start.current === null) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    start.current = null;
    const shouldStart = !cancelled && progressRef.current >= 0.55;
    progressRef.current = 0; setProgress(0);
    if (shouldStart && !disabled) onStart();
  }
  return <div className="driver-offline">
    <header className="driver-profile"><div className="driver-profile__identity"><div className="driver-avatar">{initials}</div><div><span className="driver-role">Motorista</span><h1>{name || 'Motorista'}</h1></div></div><span className="driver-pill driver-pill--offline"><i />Offline</span></header>
    <main className="driver-offline__main"><div className="driver-welcome"><div className="driver-welcome__icon"><Icon name="bike" size={38}/><span>ϟ</span></div><h2>Pronto para rodar?</h2><p>Fique online para receber chamadas de coleta. Durante o serviço, sua localização será compartilhada com a central.</p><div className="driver-features"><div><DriverIcon name="radio"/><span>GPS em serviço</span></div><div><DriverIcon name="package"/><span>Chamadas de coleta</span></div><div><Icon name="shield"/><span>Conexão segura</span></div></div>{children}</div></main>
    <div className="driver-offline__footer"><div ref={track} className={`driver-slider${disabled?' driver-slider--disabled':''}`} onPointerDown={event=>{if(disabled || (event.pointerType==='mouse' && event.button!==0))return;start.current=event.clientX;event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={move} onPointerUp={event=>finish(event)} onPointerCancel={event=>finish(event,true)}>
      <div className="driver-slider__fill" style={{width:`${Math.max(4, progress*100)}%`}}/><span className="driver-slider__text">DESLIZE PARA FICAR ONLINE <DriverIcon name="chevrons" size={16}/></span><span className="driver-slider__puck" style={{left:`calc(5px + ${progress*100}% - ${progress*62}px)`}}><DriverIcon name="power" size={24}/></span>
    </div><button type="button" className="driver-start-link" onClick={onStart} disabled={disabled} aria-label="Entrar em serviço">ϟ &nbsp;Ou toque aqui para iniciar direto</button><button type="button" className="driver-logout-link" onClick={onLogout}>Sair da conta</button><small>EncomendasZap · Área do motorista</small></div>
  </div>;
}
