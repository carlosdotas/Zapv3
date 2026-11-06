import type { Express } from 'express';
import { prisma } from '../db';
import { resolveCaller, canCallerSeeOrder } from '../access';
import { collectionOwnership } from '../../shared/collectionOwnership';
import { pedidoToBackend, pedidoLocationIds, todaySaoPaulo } from '../mappers';
import { route } from '../http/registerRoute';
import { pedidosToBackend } from './support/orderSupport';

export function registerMarkersRoutes(app: Express) {
route(app, '/tracking/order_markers', async (req, res, body) => {
    const from = body.data_ini ? String(body.data_ini).slice(0, 10) : null;
    const to = body.data_fim ? String(body.data_fim).slice(0, 10) : null;
    const where = from || to
      ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : { date: String(body.date || todaySaoPaulo()).slice(0, 10) };
    const caller = await resolveCaller(req, body);
    const rows = await prisma.orders.findMany({ where });
    const orderViews = await pedidosToBackend(rows);
    const visibleOrderIds = new Set(
      orderViews.filter(order => canCallerSeeOrder(order, caller)).map(order => String(order.id))
    );
    const visibleRows = rows.filter(row => visibleOrderIds.has(String(row.id)));
    const ids = pedidoLocationIds(visibleRows);
    const locations = new Map<number, any>();
    if (ids.length) (await prisma.locations.findMany({ where: { id: { in: ids } } })).forEach(l => locations.set(l.id, l));

    const markers: any[] = [];
    for (const row of visibleRows) {
      const view = pedidoToBackend(row);
      const isExchange = view.tipo_encomenda === 'troca';
      const etapa = String(view.etapa || 'pendente').toLowerCase().trim();

      // Pedidos entregues/finalizados/cancelados não entram nos marcadores ativos do mapa
      if (etapa === 'entregue' || etapa === 'finalizado' || etapa === 'cancelado') {
        continue;
      }

      const base = {
        pedido_id: row.id,
        etapa: view.etapa,
        cliente: row.client_name,
        data: row.date,
        tipo_encomenda: view.tipo_encomenda,
        is_exchange: isExchange,
        accepted_by_driver: Boolean(view.acceptedByDriver),
        collection_restricted: collectionOwnership(view).collectionRestricted,
        collection_owner_id: collectionOwnership(view).collectionOwnerId
      };

      const pickupLoc = row.pickup_location_id ? locations.get(row.pickup_location_id) : null;
      const deliveryLoc = row.delivery_location_id ? locations.get(row.delivery_location_id) : null;
      const coletaLat = pickupLoc?.lat ?? view.coleta_lat ?? view.coleta_locais_lat;
      const coletaLng = pickupLoc?.lng ?? view.coleta_lng ?? view.coleta_locais_lng;
      const entregaLat = deliveryLoc?.lat ?? view.entrega_lat ?? view.entrega_locais_lat;
      const entregaLng = deliveryLoc?.lng ?? view.entrega_lng ?? view.entrega_locais_lng;

      const hasColetaLocation = coletaLat != null && coletaLng != null && !isNaN(Number(coletaLat));
      const hasEntregaLocation = entregaLat != null && entregaLng != null && !isNaN(Number(entregaLat));

      const push = (tipo: string, locationId: number | null) => {
        const loc = locationId ? locations.get(locationId) : null;
        const lat = tipo === 'coleta' ? coletaLat : entregaLat;
        const lng = tipo === 'coleta' ? coletaLng : entregaLng;
        if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) return;
        const localName = loc?.name || (tipo === 'coleta' ? (view.coleta_nome || view.coleta_local || 'Local de Coleta') : (view.entrega_nome || view.entrega_local || 'Local de Entrega'));
        const assignedDriverId = tipo === 'coleta'
          ? (view.coleta_user_id || view.pickupAssignedDriverId || view.assignedDriverId || view.motorista_id)
          : tipo === 'troca'
            ? (view.exchangeAssignedDriverId || view.assignedDriverId || view.motorista_id)
            : (view.entrega_user_id || view.deliveryAssignedDriverId || view.assignedDriverId || view.motorista_id);
        const assignedDriverName = tipo === 'coleta'
          ? (view.coleta_user_nome || view.pickupAssignedDriverName || view.assignedDriverName || view.motorista_nome)
          : tipo === 'troca'
            ? (view.exchangeAssignedDriverName || view.assignedDriverName || view.motorista_nome)
            : (view.entrega_user_nome || view.deliveryAssignedDriverName || view.assignedDriverName || view.motorista_nome);
        const assignedDriverPhone = tipo === 'coleta'
          ? (view.pickupAssignedDriverPhone || view.assignedDriverPhone || view.motorista_telefone)
          : tipo === 'troca'
            ? (view.exchangeAssignedDriverPhone || view.assignedDriverPhone || view.motorista_telefone)
            : (view.deliveryAssignedDriverPhone || view.assignedDriverPhone || view.motorista_telefone);
        const pointVis = tipo === 'coleta'
          ? (view.pickupVisibility || view.orderVisibility)
          : tipo === 'troca'
            ? (view.exchangeVisibility || view.orderVisibility)
            : (view.deliveryVisibility || view.orderVisibility);
        markers.push({
          ...base,
          tipo,
          has_coleta: hasColetaLocation,
          local_id: loc?.id || 0,
          local_name: localName,
          lat: Number(lat),
          lng: Number(lng),
          assigned_driver_id: assignedDriverId ? String(assignedDriverId) : undefined,
          assigned_driver_name: assignedDriverName ? String(assignedDriverName) : undefined,
          assigned_driver_phone: assignedDriverPhone ? String(assignedDriverPhone) : undefined,
          motorista_id: assignedDriverId ? String(assignedDriverId) : undefined,
          order_visibility: pointVis || (assignedDriverId ? 'privado' : 'publico')
        });
      };

      const isColetaAtiva = etapa === 'aprovado' || etapa === 'pendente' || etapa === 'coletando';
      const isColetado = etapa === 'coletado' || etapa === 'trocando' || etapa === 'trocado' || etapa === 'retornando' || etapa === 'entregando';
      const isTrocado = etapa === 'trocado' || etapa === 'retornando' || etapa === 'segunda_entrega' || etapa === 'retorno';

      // Regra EncomendasZap: Cada pedido ativo tem apenas 1 ponto ativo no mapa por vez!
      // 1) Se possui coleta e ainda não foi coletado: entra apenas o local de coleta
      // 2) Se for troca: 1º Coleta -> 2º Troca -> 3º Retorno à Coleta
      // 3) Se não possui coleta (somente entrega) ou já foi coletado: entra o local de entrega
      if (hasColetaLocation && isColetaAtiva) {
        push('coleta', row.pickup_location_id);
      } else if (isExchange) {
        if (isTrocado) {
          push('entrega', row.origin_location_id || row.pickup_location_id);
        } else if (isColetado) {
          push('troca', row.delivery_location_id);
        } else {
          push('coleta', row.pickup_location_id);
        }
      } else if (hasEntregaLocation) {
        push('entrega', row.delivery_location_id);
      } else if (hasColetaLocation && !isColetado) {
        push('coleta', row.pickup_location_id);
      }
    }
    res.json({ success: true, data: markers });
  });
}
