
import type { RealtimeServices } from './types';
import { MAX_OFFLINE_MS } from './constants';

export function startRealtimeTimers({ activeDrivers, broadcast, dispatchUrgentOrders }: Pick<RealtimeServices, 'activeDrivers' | 'broadcast' | 'dispatchUrgentOrders'>) {
  const driverCleanup = setInterval(() => {
    const now = Date.now();
    activeDrivers.forEach((driver, id) => {
      if (now - (driver.lastSeenTimestamp || 0) > MAX_OFFLINE_MS) {
        activeDrivers.delete(id);
        broadcast({ type: 'driver:remove', driverId: id });
      }
    });
  }, 30 * 1000);
  driverCleanup.unref();

  const urgentDispatchTimer = setInterval(() => {
    void dispatchUrgentOrders().catch(err => console.warn('[Urgent Dispatch] Falha ao verificar coletas:', err?.message || err));
  }, 10 * 1000);
  urgentDispatchTimer.unref();


  return () => { clearInterval(driverCleanup); clearInterval(urgentDispatchTimer); };
}
