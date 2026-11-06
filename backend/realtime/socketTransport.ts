import { WebSocket, WebSocketServer } from 'ws';
import { prisma } from '../db';
import { isAssignmentMine } from '../access';
import type { RealtimeServices } from './types';

export function registerSocketTransport(wss: WebSocketServer, { authenticatedSockets, socketsByUserId, validDrivers, resendUrgentOffers, dispatchUrgentOrders, upsertDriver }: Pick<RealtimeServices, 'authenticatedSockets' | 'socketsByUserId' | 'validDrivers' | 'resendUrgentOffers' | 'dispatchUrgentOrders' | 'upsertDriver'>) {
  let disposed = false;
  const authTimers = new Set<ReturnType<typeof setTimeout>>();
  const onConnection = (ws: WebSocket) => {
    const authTimeout = setTimeout(() => ws.close(4401, 'Autenticação necessária'), 5000);
    authTimers.add(authTimeout);

    ws.on('message', raw => {
      if (disposed) return;
      try {
        const msg = JSON.parse(raw.toString());
        const caller = authenticatedSockets.get(ws);
        if (!caller && msg.type === 'auth' && typeof msg.token === 'string') {
          void prisma.user_sessions.findUnique({
            where: { token: msg.token },
            include: { user: true }
          }).then(session => {
            if (disposed || ws.readyState !== WebSocket.OPEN) return;
            if (!session?.is_logged || !session.user) {
              ws.close(4401, 'Sessão inválida');
              return;
            }
            clearTimeout(authTimeout); authTimers.delete(authTimeout);
            const user = {
              id: session.user.id,
              role: String(session.user.access_level || '').toLowerCase(),
              phone: String(session.user.phone || '').replace(/\D/g, '')
            };
            authenticatedSockets.set(ws, user);
            if (!socketsByUserId.has(user.id)) socketsByUserId.set(user.id, new Set());
            socketsByUserId.get(user.id)!.add(ws);
            ws.send(JSON.stringify({ type: 'drivers:init', drivers: validDrivers() }));
            resendUrgentOffers(user.id, ws);
            void dispatchUrgentOrders().catch(err => console.warn('[Urgent Dispatch] Falha ao verificar coletas:', err?.message || err));
          }).catch(() => ws.close(4401, 'Falha ao validar sessão'));
          return;
        }
        if (!caller) return;
        if (msg.type === 'driver:update_location' && msg.driver) {
          const driverId = String(msg.driver.id || '');
          const driverPhone = String(msg.driver.phone || '');
          if (caller.role !== 'motorista' || !isAssignmentMine({ driverId, driverPhone }, caller)) return;
          upsertDriver(msg.driver);
          void dispatchUrgentOrders().catch(err => console.warn('[Urgent Dispatch] Falha ao verificar coletas:', err?.message || err));
        }
      } catch {
        // payload inválido é ignorado
      }
    });
    ws.on('close', () => {
      clearTimeout(authTimeout); authTimers.delete(authTimeout);
      const caller = authenticatedSockets.get(ws);
      if (!caller) return;
      authenticatedSockets.delete(ws);
      const sockets = socketsByUserId.get(caller.id);
      sockets?.delete(ws);
      if (!sockets?.size) socketsByUserId.delete(caller.id);
    });
    ws.on('error', () => {});
  };

  wss.on('connection', onConnection);
  return () => { disposed = true; wss.off('connection', onConnection); authTimers.forEach(clearTimeout); authTimers.clear(); };
}
