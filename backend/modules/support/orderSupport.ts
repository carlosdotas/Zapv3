import { prisma } from '../../db';
import { notifyOrderProgress, etapaEvent } from '../../notifications';
import { CLOSED_ORDER_STAGES } from '../../orderStatus';
import { claimPickupTransition } from '../../pickupTransition';
import { isAfterPickupStage } from '../../../shared/collectionOwnership';
import { pedidoToBackend, pedidoFromBackend, pedidoLocationIds, cleanPedidoId, toInt, hasValue } from '../../mappers';

export async function findPedido(raw: unknown) {
  const id = toInt(cleanPedidoId(raw));
  return id ? prisma.orders.findUnique({ where: { id } }) : null;
}

export async function pedidosToBackend(rows: any[]) {
  const ids = pedidoLocationIds(rows);
  const locations = new Map<number, any>();
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 500) {
      const found = await prisma.locations.findMany({ where: { id: { in: ids.slice(i, i + 500) } } });
      found.forEach(l => locations.set(l.id, l));
    }
  }
  return rows.map(row => pedidoToBackend(row, locations));
}

export async function logStage(orderId: number, before: string, after: string, userId?: unknown, details?: string) {
  if (before === after) return;
  try {
    await prisma.order_logs.create({
      data: { order_id: orderId, user_id: toInt(userId), stage_before: before, stage_after: after, details: details || null }
    });
  } catch {
    // o log nunca deve impedir a operação principal
  }
}

export const NEXT_ETAPA: Record<string, (tipo: string) => string> = {
  pendente: () => 'coletando',
  aprovado: () => 'coletando',
  coletando: () => 'coletado',
  coletado: tipo => (tipo === 'troca' ? 'trocando' : 'entregando'),
  trocando: () => 'trocado',
  trocado: () => 'retornando',
  retornando: () => 'entregue',
  entregando: () => 'entregue'
};

export const LIMITE_DISTANCIA_BAIXA_M = 1000;

export const fmtDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`);

export async function applyEtapa(
  existing: any,
  etapa: string,
  userId?: unknown,
  userName?: string,
  proximity?: { distance?: unknown; lat?: unknown; lng?: unknown }
) {
  const nowIso = new Date().toISOString();
  const patch: any = { etapa };
  const op = etapa === 'coletado' ? 'coleta' : etapa === 'trocado' || etapa === 'troca' ? 'troca' : etapa === 'entregue' ? 'entrega' : '';
  // Só registra quando a baixa foi feita a mais de 1 km do local
  const distance = Number(proximity?.distance);
  const farAway = op && Number.isFinite(distance) && distance > LIMITE_DISTANCIA_BAIXA_M;
  if (farAway) {
    patch[`${op}_distancia_m`] = Math.round(distance);
    const lat = Number(proximity?.lat);
    const lng = Number(proximity?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      patch[`${op}_baixa_lat`] = lat;
      patch[`${op}_baixa_lng`] = lng;
    }
  }
  if (etapa === 'coletado') {
    patch.coleta_saida_at = nowIso;
    if (userId) patch.coleta_user_id = userId;
    if (userName) patch.coleta_user_nome = userName;
  } else if (etapa === 'trocado' || etapa === 'troca') {
    patch.troca_saida_at = nowIso;
    patch.troca_at = nowIso;
    if (userId) patch.troca_user_id = userId;
    if (userName) patch.troca_user_nome = userName;
  } else if (etapa === 'entregue') {
    patch.entrega_saida_at = nowIso;
    patch.entrega_at = nowIso;
    if (userId) patch.entrega_user_id = userId;
    if (userName) patch.entrega_user_nome = userName;
    patch.status_pagamento = 'pago';
  } else if (etapa === 'finalizado') {
    patch.status_pagamento = 'pago';
    patch.finalizado_em = nowIso;
    if (!existing?.delivered_at) patch.entrega_saida_at = nowIso;
  }
  const data = pedidoFromBackend(patch, existing);
  // Sem pedido existente não cria um novo: isso gerava pedidos "fantasmas" já finalizados.
  if (!existing) return null;
  let updated;
  if (etapa === 'coletado') {
    if (isAfterPickupStage(pedidoToBackend(existing).etapa)) return null;
    if (!await claimPickupTransition(prisma.orders, existing, data)) return null;
    updated = await prisma.orders.findUnique({ where: { id: existing.id } });
    if (!updated) return null;
  } else {
    updated = await prisma.orders.update({ where: { id: existing.id }, data });
  }
  await logStage(
    existing.id,
    existing.stage,
    updated.stage,
    userId,
    farAway ? `Baixa feita a ${fmtDistance(distance)} do local` : undefined
  );
  if (existing.stage !== updated.stage) {
    let actor = userName;
    const actorId = toInt(userId);
    if (!actor && actorId) actor = (await prisma.users.findUnique({ where: { id: actorId }, select: { name: true } }))?.name;
    const event = etapaEvent(etapa, existing.id, actor);
    if (event && farAway) event.message += ` Baixa feita a ${fmtDistance(distance)} do local.`;
    if (event) void notifyOrderProgress({ id: existing.id, client_id: existing.client_id }, event, actorId);
  }
  return updated;
}

export async function searchPedidosWhere(body: any) {
  const where: any = {};
  const and: any[] = [];

  const rawId = body.id;
  if (hasValue(rawId)) {
    const id = toInt(cleanPedidoId(rawId));
    and.push({ id: id ?? -1 });
  }
  if (hasValue(body.clientes_id ?? body.cliente_id)) {
    and.push({ client_id: toInt(body.clientes_id ?? body.cliente_id) ?? -1 });
  }
  if (hasValue(body.motorista_id)) {
    const m = String(body.motorista_id);
    const mid = toInt(m);
    and.push({
      OR: [
        ...(mid ? [{ collector_id: mid }] : []),
        { orig_drivers: { contains: m } },
        { dest_drivers: { contains: m } }
      ]
    });
  }
  if (body.tipo_encomenda) {
    const t = String(body.tipo_encomenda).toLowerCase();
    and.push({ order_type: t === 'troca' ? 'coleta_entrega' : t });
  }
  if (body.tipo_veiculo) {
    const v = String(body.tipo_veiculo).toLowerCase();
    and.push({ vehicle_type: v === 'utilitario' ? { in: ['pick_up', 'van', 'caminhao'] } : v });
  }
  if (body.status_pagamento) {
    const s = String(body.status_pagamento).toLowerCase();
    and.push({ payment_status: s === 'pago' ? 'pago' : 'nao_pago' });
  }
  if (body.cidade) {
    const c = String(body.cidade);
    and.push({ OR: [{ orig_city: { contains: c } }, { dest_city: { contains: c } }] });
  }
  if (body.nome) {
    const q = String(body.nome).trim();
    and.push({ OR: [{ client_name: { contains: q } }, { item_name: { contains: q } }, { contact_phone: { contains: q } }] });
  }
  if (body.data_ini) and.push({ date: { gte: String(body.data_ini).slice(0, 10) } });
  if (body.data_fim) and.push({ date: { lte: String(body.data_fim).slice(0, 10) } });
  if (body.active_only === true || body.active_only === 'true' || body.active_only === 1) {
    and.push({ stage: { notIn: CLOSED_ORDER_STAGES } });
  }
  if (body.completed_only === true || body.completed_only === 'true' || body.completed_only === 1) {
    and.push({ stage: { in: CLOSED_ORDER_STAGES } });
  }
  if (and.length) where.AND = and;
  return where;
}
