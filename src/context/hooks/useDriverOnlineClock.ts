import { useState, useCallback, useEffect } from 'react';

export function useDriverOnlineClock() {
  const [isDriverOnline, setIsDriverOnlineState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('encomendaszap_driver_online') === 'true';
    } catch (e) {
      return false;
    }
  });

  const ONLINE_SINCE_KEY = 'encomendaszap_driver_online_since';
  const readOnlineSince = (): number => {
    try {
      const v = Number(localStorage.getItem(ONLINE_SINCE_KEY));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  };

  const [driverActiveSeconds, setDriverActiveSeconds] = useState<number>(() => {
    const since = readOnlineSince();
    return since ? Math.max(0, Math.floor((Date.now() - since) / 1000)) : 0;
  });

  const setIsDriverOnline = useCallback((online: boolean) => {
    setIsDriverOnlineState(online);
    try {
      localStorage.setItem('encomendaszap_driver_online', online ? 'true' : 'false');
      if (online) {
        // Mantém o início original se já estava online (ex.: recarregou a página)
        if (!readOnlineSince()) localStorage.setItem(ONLINE_SINCE_KEY, String(Date.now()));
      } else {
        localStorage.removeItem(ONLINE_SINCE_KEY);
      }
    } catch (e) {
      // ignore
    }
    if (online) {
      const since = readOnlineSince();
      setDriverActiveSeconds(since ? Math.max(0, Math.floor((Date.now() - since) / 1000)) : 0);
    } else {
      setDriverActiveSeconds(0);
    }
  }, []);

  // Mantém o relógio de sessão sem forçar a re-renderização de todo o mapa a cada segundo.
  useEffect(() => {
    if (!isDriverOnline) return;
    if (!readOnlineSince()) {
      try { localStorage.setItem(ONLINE_SINCE_KEY, String(Date.now())); } catch (e) { /* ignore */ }
    }
    const tick = () => {
      const since = readOnlineSince() || Date.now();
      setDriverActiveSeconds(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, [isDriverOnline]);
  

  return { isDriverOnline, setIsDriverOnlineState, ONLINE_SINCE_KEY, readOnlineSince, driverActiveSeconds, setDriverActiveSeconds, setIsDriverOnline };
}
