import type { Express, Request, Response } from 'express';
import { prisma } from '../db';
import { parseRawJsonBody } from '../http/parseRawJsonBody';
import { toInt } from '../mappers';
import { getDriverPermanentColor } from '../../shared/driverColors';
import type { RealtimeServices } from './types';
import { TRACKING_HISTORY_INTERVAL_MS } from './constants';

export function registerTrackingRoutes(app: Express, { activeDrivers, validDrivers, upsertDriver, lastHistoryWrite, dispatchUrgentOrders, noCache }: Pick<RealtimeServices, 'activeDrivers' | 'validDrivers' | 'upsertDriver' | 'lastHistoryWrite' | 'dispatchUrgentOrders' | 'noCache'>) {
  app.get('/api/tracking/live-drivers', (_req: Request, res: Response) => {
    noCache(res);
    res.json({ success: true, data: validDrivers() });
  });

  app.post('/api/tracking/update-driver', (req: Request, res: Response) => {
    const body = parseRawJsonBody(req);
    if (!body?.id) {
      res.status(400).json({ success: false, message: 'Dados inválidos' });
      return;
    }
    const driver = upsertDriver(body);
    void dispatchUrgentOrders().catch(err => console.warn('[Urgent Dispatch] Falha ao verificar coletas:', err?.message || err));
    res.json({ success: true, data: driver });
  });


}

export function registerLegacyTrackingRoutes(app: Express, { activeDrivers, validDrivers, upsertDriver, lastHistoryWrite }: Pick<RealtimeServices, 'activeDrivers' | 'validDrivers' | 'upsertDriver' | 'lastHistoryWrite'>) {
  // Endpoints de rastreamento no formato legado (/tracking/*), usados pelo app dos motoristas
  const legacy = (path: string, handler: (body: any, res: Response) => Promise<void> | void) => {
    app.all([path, `/api${path}`], async (req: Request, res: Response) => {
      try {
        await handler(parseRawJsonBody(req), res);
      } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
      }
    });
  };

  const driverFromBody = (body: any, coords?: { lat: number; lng: number }): any => {
    const id = String(body.user_id);
    const previous = activeDrivers.get(id);
    const permanentColor = getDriverPermanentColor(id || body.user_nome);
    return {
      color: previous?.color || permanentColor,
      vehicleType: 'moto',
      ...previous,
      id,
      name: body.user_nome || previous?.name || `Motorista ${id}`,
      avatarUrl: body.user_foto || previous?.avatarUrl,
      isOnline: true,
      status: previous?.status && previous.status !== 'offline' ? previous.status : 'disponivel',
      coordinates: coords
        ? { lat: coords.lat, lng: coords.lng, heading: body.heading ?? null, speed: body.speed ?? null, timestamp: Date.now() }
        : previous?.coordinates
    };
  };

  legacy('/tracking/live_locations', (_body, res) => {
    const data = validDrivers()
      .filter(d => d.coordinates)
      .map(d => ({
        user_id: d.id,
        user_nome: d.name,
        user_foto: d.avatarUrl,
        lat: d.coordinates.lat,
        lng: d.coordinates.lng,
        speed: d.coordinates.speed ?? null,
        heading: d.coordinates.heading ?? null,
        updated_at: new Date(d.lastSeenTimestamp).toISOString()
      }));
    res.json({ success: true, data });
  });

  legacy('/tracking/update_location', async (body, res) => {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!body.user_id || isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ success: false, message: 'user_id, lat e lng são obrigatórios' });
      return;
    }
    upsertDriver(driverFromBody(body, { lat, lng }));

    const userId = toInt(body.user_id);
    const now = Date.now();
    if (userId && now - (lastHistoryWrite.get(String(userId)) || 0) >= TRACKING_HISTORY_INTERVAL_MS) {
      lastHistoryWrite.set(String(userId), now);
      await prisma.driver_tracking.create({ data: { user_id: userId, lat, lng, timestamp: now } }).catch(() => null);
    }
    res.json({ success: true });
  });

  legacy('/tracking/heartbeat', (body, res) => {
    if (!body.user_id) {
      res.status(400).json({ success: false, message: 'user_id é obrigatório' });
      return;
    }
    const driver = driverFromBody(body);
    if (driver.coordinates) upsertDriver(driver);
    res.json({ success: true });
  });

}
