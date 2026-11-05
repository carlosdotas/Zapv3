import { useState } from 'react';
import { DriverIcon } from './driver-icons';

export type PickupCall = { id:string; professionalId:string; status:string; expiresAt:string; companyName?:string; pickupName?:string|null; pickupAddress?:string|null; distanceKm?:number|null };
type Answer = 'accepted' | 'rejected';

export function DriverCall({ call, now, onAnswer }: { call: PickupCall; now: number; onAnswer: (id: string, answer: Answer) => Promise<string | undefined> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seconds = Math.max(0, Math.ceil((Date.parse(call.expiresAt) - now) / 1000));
  async function answer(choice: Answer) {
    if (busy) return;
    setBusy(true); setError('');
    const result = await onAnswer(call.id, choice);
    if (result) setError(result);
    setBusy(false);
  }
  return <section className="incoming-call" role="alert" aria-label="Chamada de coleta de teste">
    <div className="incoming-call__heading"><span className="incoming-call__icon"><DriverIcon name="bell" size={23}/></span><div><span>CHAMADA RECEBIDA · TESTE</span><h2>Nova coleta para você</h2></div><strong className="incoming-call__timer">{seconds}s</strong></div>
    <div className="incoming-call__body"><div><span>Transportadora</span><strong>{call.companyName || 'Não informada'}</strong></div><div><span>Local de coleta</span><strong>{call.pickupName || 'Não informado'}</strong></div><div><span>Endereço</span><strong>{call.pickupAddress || 'Não informado'}</strong></div><div><span>Distância aproximada</span><strong>{typeof call.distanceKm === 'number' ? `${call.distanceKm.toLocaleString('pt-BR', {maximumFractionDigits: 2})} km em linha reta` : 'Indisponível'}</strong></div></div>
    {error && <p className="incoming-call__error" role="status">{error}</p>}
    <div className="incoming-call__actions"><button type="button" onClick={()=>void answer('rejected')} disabled={busy}>Recusar</button><button type="button" onClick={()=>void answer('accepted')} disabled={busy}>{busy ? 'Aguarde...' : 'Aceitar chamada'}</button></div>
  </section>;
}
