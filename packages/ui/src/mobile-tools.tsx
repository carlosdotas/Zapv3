import { useEffect, useState } from 'react';

type NativeBridge = {
  isNativeApp?: () => boolean;
  getAppProfile?: () => string;
  requestLocation?: () => void;
  stopLocation?: () => void;
  showNotification?: (title: string, message: string) => void;
  openCall?: (phone: string) => void;
  pickContact?: () => void;
};

declare global {
  interface Window {
    AndroidApp?: NativeBridge;
  }
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

function formatPhone(value: string) {
  const digits = digitsOnly(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  const split = digits.length > 10 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`;
}

export function MobileTools() {
  const [bridge, setBridge] = useState<NativeBridge | null>(null);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const nativeBridge = typeof window !== 'undefined' ? window.AndroidApp : undefined;
    if (!nativeBridge?.isNativeApp?.()) return;
    setBridge(nativeBridge);

    const onContactSelected = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string }>).detail;
      if (detail?.phone) {
        setPhone(formatPhone(detail.phone));
        setStatus('Contato selecionado na agenda.');
      }
    };
    window.addEventListener('zapContactSelected', onContactSelected);
    return () => window.removeEventListener('zapContactSelected', onContactSelected);
  }, []);

  if (!bridge) return null;
  const nativeBridge = bridge;

  const profile = nativeBridge.getAppProfile?.() === 'transportadora' ? 'transportadora' : 'motorista';

  function requestLocation() {
    nativeBridge.requestLocation?.();
    setStatus('Permissão de localização solicitada.');
  }

  function testNotification() {
    nativeBridge.showNotification?.('Nova chamada', 'Você recebeu uma chamada de teste.');
    setStatus('Notificação de teste enviada.');
  }

  function openContactPicker() {
    nativeBridge.pickContact?.();
    setStatus('Escolha um contato na agenda do aparelho.');
  }

  function callContact() {
    const digits = digitsOnly(phone);
    if (digits.length < 10) {
      setStatus('Informe um telefone válido com DDD.');
      return;
    }
    nativeBridge.openCall?.(`+55${digits}`);
    setStatus('Abrindo o telefone do aparelho.');
  }

  return <section className="mobile-tools" aria-label="Ferramentas do aplicativo">
    <div className="mobile-tools__heading">
      <span className="mobile-tools__eyebrow">Aplicativo {profile}</span>
      <h2>Recursos rápidos</h2>
      <p>Use localização, notificações e contatos durante a operação.</p>
    </div>
    <div className="mobile-tools__grid">
      <button type="button" className="mobile-tools__action" onClick={requestLocation}>Ativar localização</button>
      <button type="button" className="mobile-tools__action" onClick={testNotification}>Testar notificação</button>
      <button type="button" className="mobile-tools__action" onClick={openContactPicker}>Abrir contatos</button>
    </div>
    <div className="mobile-tools__call">
      <label htmlFor="mobile-call-phone">Telefone para chamada</label>
      <div className="mobile-tools__call-row">
        <input id="mobile-call-phone" type="tel" inputMode="tel" value={phone} onChange={event => setPhone(formatPhone(event.target.value))} placeholder="(62) 99999-9999" />
        <button type="button" className="mobile-tools__call-button" onClick={callContact}>Ligar</button>
      </div>
    </div>
    {status && <p className="mobile-tools__status" role="status">{status}</p>}
  </section>;
}
