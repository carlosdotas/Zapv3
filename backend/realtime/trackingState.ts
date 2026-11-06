import { getDriverPermanentColor } from '../../shared/driverColors';
import type { RealtimeServices, LiveDriverData } from './types';
import { MAX_OFFLINE_MS } from './constants';

export function createTrackingState({ activeDrivers, broadcast }: Pick<RealtimeServices, 'activeDrivers' | 'broadcast'>) {
  const validDrivers = () => {
    const now = Date.now();
    return Array.from(activeDrivers.values()).filter(d => now - d.lastSeenTimestamp <= MAX_OFFLINE_MS && d.isOnline !== false);
  };

  function upsertDriver(d: any): LiveDriverData {
    const now = Date.now();
    const id = String(d.id);
    const permanentColor = getDriverPermanentColor(id || d.phone || d.name);
    const driver: LiveDriverData = {
      ...d,
      id,
      color: d.color && d.color !== '#FF5E00' && d.color !== '#2563eb' ? d.color : permanentColor,
      lastSeenTimestamp: now,
      lastUpdatedStr: new Date(now).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status: d.isOnline === false ? 'offline' : d.status || 'em_rota'
    };
    activeDrivers.set(id, driver);
    broadcast({ type: d.isOnline === false ? 'driver:offline' : 'driver:update', driver });
    return driver;
  }


  return { validDrivers, upsertDriver };
}
