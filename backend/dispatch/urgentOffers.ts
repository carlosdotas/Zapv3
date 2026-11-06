import { WebSocket } from 'ws';
import { prisma } from '../db';
import { parseExtra, pedidoToBackend } from '../mappers';
import { isAssignmentMine } from '../access';
import { distanceInKm, nearestAvailableDriver, URGENT_PICKUP_STAGES } from '../urgentDispatch';
import type { RealtimeServices, UrgentOfferState } from '../realtime/types';
import { opOfKey, numOfKey } from '../realtime/legacyKeys';
import { URGENT_OFFER_DURATION_MS } from '../realtime/constants';

export function createUrgentDispatch({ urgentOffers, activeAssignments, authenticatedSockets, sendToUser, validDrivers }: Pick<RealtimeServices, 'urgentOffers' | 'activeAssignments' | 'authenticatedSockets' | 'sendToUser' | 'validDrivers'>) {
  let dispatchInProgress = false;
  let disposed = false;
  function resendUrgentOffers(userId: number, socket: WebSocket) {
    for (const state of urgentOffers.values()) {
      if (state.currentDriverId !== String(userId) || !state.expiresAt || state.expiresAt <= Date.now()) continue;
      socket.send(JSON.stringify({
        type: 'urgent:offer',
        offerId: state.orderKey,
        expiresAt: state.expiresAt,
        place: state.place
      }));
    }
  }

  function cancelUrgentOffer(orderId: string) {
    const assignedOrderId = numOfKey(orderId);
    const assignedOperation = opOfKey(orderId);
    for (const [key, state] of urgentOffers) {
      if (
        state.orderId !== orderId &&
        state.orderKey !== orderId &&
        (state.orderId !== assignedOrderId || (assignedOperation && assignedOperation !== 'coleta'))
      ) continue;
      if (state.timeout) clearTimeout(state.timeout);
      if (state.currentDriverId) {
        const driverId = Number(state.currentDriverId);
        if (Number.isFinite(driverId)) sendToUser(driverId, { type: 'urgent:cancel', offerId: state.orderKey });
      }
      urgentOffers.delete(key);
    }
  }

  function sendNextUrgentOffer(state: UrgentOfferState, radiusKm: number) {
    if (disposed) return;
    if (state.timeout) clearTimeout(state.timeout);
    const pickup = state.place.coordinates as { lat: number; lng: number };
    const userByDriverId = new Map<string, number>();
    const nearby = validDrivers()
      .filter(driver =>
        driver.status !== 'em_pausa' &&
        driver.status !== 'offline' &&
        Number.isFinite(driver.coordinates?.lat) &&
        Number.isFinite(driver.coordinates?.lng)
      )
      .map(driver => {
        const recipient = Array.from(authenticatedSockets.entries()).find(([socket, caller]) =>
          socket.readyState === WebSocket.OPEN &&
          caller.role === 'motorista' &&
          isAssignmentMine({ driverId: driver.id, driverPhone: driver.phone }, caller)
        )?.[1].id;
        if (recipient !== undefined) userByDriverId.set(String(driver.id), recipient);
        return {
          id: String(driver.id),
          distanceKm: distanceInKm(pickup, driver.coordinates)
        };
      })
      .filter(driver => userByDriverId.has(driver.id));
    const next = nearestAvailableDriver(nearby, state.attemptedDriverIds, radiusKm);
    if (!next) {
      state.currentDriverId = undefined;
      state.currentDriverKey = undefined;
      state.expiresAt = undefined;
      return;
    }

    state.currentDriverId = String(userByDriverId.get(next.id));
    state.currentDriverKey = next.id;
    state.expiresAt = Date.now() + URGENT_OFFER_DURATION_MS;
    const recipientId = userByDriverId.get(next.id);
    if (recipientId === undefined) return;
    sendToUser(recipientId, {
      type: 'urgent:offer',
      offerId: state.orderKey,
      expiresAt: state.expiresAt,
      distanceKm: next.distanceKm,
      place: state.place
    });
    state.timeout = setTimeout(() => {
      if (urgentOffers.get(state.orderKey) !== state) return;
      sendToUser(recipientId, { type: 'urgent:cancel', offerId: state.orderKey });
      state.attemptedDriverIds.add(next.id);
      state.attemptedDriverIds.add(String(recipientId));
      sendNextUrgentOffer(state, radiusKm);
    }, URGENT_OFFER_DURATION_MS);
  }

  async function dispatchUrgentOrders() {
    if (disposed || dispatchInProgress) return;
    if (
      urgentOffers.size === 0 &&
      !Array.from(authenticatedSockets.values()).some(caller => caller.role === 'motorista')
    ) return;
    dispatchInProgress = true;
    try {
    const settingsRow = await prisma.app_settings.findUnique({ where: { key: 'global_config' } });
    const settings = settingsRow ? parseExtra(settingsRow.value) : {};
    const configuredRadius = Number((settings.operation as any)?.urgentNotificationRadiusKm);
    const radiusKm = Number.isFinite(configuredRadius) ? Math.min(50, Math.max(1, configuredRadius)) : 5;
    const rows = await prisma.orders.findMany({
      where: { stage: { in: [...URGENT_PICKUP_STAGES] } },
      orderBy: { created_at: 'asc' }
    });
    if (disposed) return;
    const pendingOrderIds = new Set(rows.map(row => String(row.id)));
    for (const state of urgentOffers.values()) {
      if (!pendingOrderIds.has(state.orderId)) cancelUrgentOffer(state.orderKey);
    }
    const locationIds = Array.from(new Set(rows.flatMap(row => [row.pickup_location_id, row.origin_location_id].filter((id): id is number => Boolean(id)))));
    const locations = new Map<number, any>();
    if (locationIds.length) {
      const locationRows = await prisma.locations.findMany({ where: { id: { in: locationIds } } });
      locationRows.forEach(location => locations.set(location.id, location));
    }

    if (disposed) return;
    for (const row of rows) {
      const order = pedidoToBackend(row, locations);
      const orderId = String(row.id);
      const orderKey = `${orderId}-coleta`;
      const pickupLocation = row.pickup_location_id ? locations.get(row.pickup_location_id) : null;
      const pickupLat = pickupLocation?.lat ?? order.coleta_lat ?? order.coleta_locais_lat;
      const pickupLng = pickupLocation?.lng ?? order.coleta_lng ?? order.coleta_locais_lng;
      const hasPickup = pickupLat != null && pickupLng != null &&
        Number.isFinite(Number(pickupLat)) && Number.isFinite(Number(pickupLng)) &&
        Number(pickupLat) >= -90 && Number(pickupLat) <= 90 &&
        Number(pickupLng) >= -180 && Number(pickupLng) <= 180 &&
        (Number(pickupLat) !== 0 || Number(pickupLng) !== 0);
      let legacyDrivers: unknown[] = [];
      if (Array.isArray(order.coleta_motoristas)) legacyDrivers = order.coleta_motoristas;
      else if (typeof order.coleta_motoristas === 'string' && order.coleta_motoristas.trim()) {
        try {
          const parsed = JSON.parse(order.coleta_motoristas);
          legacyDrivers = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          legacyDrivers = [order.coleta_motoristas];
        }
      }
      const hasAssignedId = (value: unknown) => {
        const normalized = String(value ?? '').trim();
        return normalized !== '' && normalized !== '0';
      };
      const assigned = hasAssignedId(order.pickupAssignedDriverId) ||
        hasAssignedId(order.coleta_user_id) ||
        legacyDrivers.some(hasAssignedId);
      const visibility = order.pickupVisibility || order.orderVisibility;
      const alreadyClaimed = Array.from(activeAssignments.keys()).some(key =>
        numOfKey(key) === orderId && (!opOfKey(key) || opOfKey(key) === 'coleta')
      );
      if (!hasPickup ||
        assigned ||
        visibility === 'privado' ||
        alreadyClaimed
      ) {
        cancelUrgentOffer(orderKey);
        continue;
      }

      const activeOffer = urgentOffers.get(orderKey);
      if (activeOffer) {
        if (!activeOffer.currentDriverId) sendNextUrgentOffer(activeOffer, radiusKm);
        continue;
      }

      const state: UrgentOfferState = {
        orderKey,
        orderId,
        attemptedDriverIds: new Set(),
        place: {
          id: `pedido-${orderId}-coleta`,
          name: String(order.coleta_nome || order.coleta_local || `Coleta do pedido #${orderId}`),
          address: String(order.coleta_endereco || order.coleta_nome || order.coleta_local || ''),
          coordinates: { lat: Number(pickupLat), lng: Number(pickupLng) },
          category: 'Coleta urgente',
          orderId,
          orderCode: String(order.codigo || orderId),
          operationType: 'coleta',
          pickupName: String(order.coleta_nome || ''),
          pickupAddress: String(order.coleta_endereco || order.coleta_nome || order.coleta_local || ''),
          pickupNotes: String(order.coleta_obs || ''),
          pickupContact: String(order.coleta_contato || order.coleta_responsavel || ''),
          pickupPhone: String(order.coleta_phone || order.coleta_responsavel_phone || ''),
          vehicleType: String(order.tipo_veiculo || ''),
          description: String(order.detalhes || order.notes || ''),
          observations: String(order.detalhes || order.notes || ''),
          orderDateBadge: String(order.data || ''),
          customerName: String(order.cliente_nome || order.client_name || '')
        }
      };
      urgentOffers.set(orderKey, state);
      sendNextUrgentOffer(state, radiusKm);
    }
    } finally {
      dispatchInProgress = false;
    }
  }


  return { resendUrgentOffers, cancelUrgentOffer, sendNextUrgentOffer, dispatchUrgentOrders, dispose: () => { disposed = true; for (const state of urgentOffers.values()) if (state.timeout) clearTimeout(state.timeout); urgentOffers.clear(); } };
}
