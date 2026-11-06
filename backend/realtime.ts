import type { Express } from 'express';
import { WebSocket, type WebSocketServer } from 'ws';
import { assignmentStore } from './realtime/assignmentStore';
import { serializeByKey } from './assignmentKeys';
import { loadAssignments, persistAssignment } from './realtime/assignmentRepository';
import { createTrackingState } from './realtime/trackingState';
import { createUrgentDispatch } from './dispatch/urgentOffers';
import { registerSocketTransport } from './realtime/socketTransport';
import { registerTrackingRoutes, registerLegacyTrackingRoutes } from './realtime/trackingRoutes';
import { registerAssignmentRoutes } from './realtime/assignmentRoutes';
import { startRealtimeTimers } from './realtime/timers';
import type { LiveDriverData, OrderAssignmentData, UrgentOfferState } from './realtime/types';
import type { Response } from 'express';

export async function registerRealtime(app: Express, wss: WebSocketServer, deps?: { notifyOrdersChanged?: () => void }) {
  const activeDrivers = new Map<string, LiveDriverData>();
  const activeAssignments = assignmentStore as unknown as Map<string, OrderAssignmentData>;
  const lastHistoryWrite = new Map<string, number>();
  const authenticatedSockets = new Map<WebSocket, { id: number; role: string; phone: string }>();
  const socketsByUserId = new Map<number, Set<WebSocket>>();
  const urgentOffers = new Map<string, UrgentOfferState>();
  const serializeAssignment = serializeByKey();

  await loadAssignments(activeAssignments);
  function broadcast(data: any, except?: WebSocket) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client !== except && client.readyState === WebSocket.OPEN) client.send(payload);
    });
  }

  function sendToUser(userId: number, data: unknown) {
    const payload = JSON.stringify(data);
    socketsByUserId.get(userId)?.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  }


  const { validDrivers, upsertDriver } = createTrackingState({ activeDrivers, broadcast });
  const urgent = createUrgentDispatch({ activeAssignments, authenticatedSockets, urgentOffers, sendToUser, validDrivers });
  const { resendUrgentOffers, cancelUrgentOffer, sendNextUrgentOffer, dispatchUrgentOrders } = urgent;
  const stopSockets = registerSocketTransport(wss, { authenticatedSockets, socketsByUserId, validDrivers, resendUrgentOffers, dispatchUrgentOrders, upsertDriver });
  const stopTimers = startRealtimeTimers({ activeDrivers, broadcast, dispatchUrgentOrders });
  const noCache = (res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/json');
  };


  registerTrackingRoutes(app, { activeDrivers, validDrivers, upsertDriver, lastHistoryWrite, dispatchUrgentOrders, noCache });
  registerAssignmentRoutes(app, { noCache, serializeAssignment, activeAssignments, cancelUrgentOffer, deps, broadcast, urgentOffers, sendToUser, sendNextUrgentOffer, persistAssignment });
  registerLegacyTrackingRoutes(app, { activeDrivers, validDrivers, upsertDriver, lastHistoryWrite });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopTimers(); stopSockets(); urgent.dispose();
    authenticatedSockets.clear(); socketsByUserId.clear(); activeDrivers.clear(); lastHistoryWrite.clear();
    wss.off('close', dispose);
  };
  wss.once('close', dispose);
  return { dispose };
}
