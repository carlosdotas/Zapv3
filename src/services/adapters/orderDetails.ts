import type { Place, PaymentConditionType } from '../../types/map';
import type { BackendPedido } from '../apiTypes';
import { extractDriverAssignmentFromPedido } from './orderAssignments';

/** Valor total e situação de pagamento do pedido, como gravados no banco. */
export function pedidoPaymentFields(pedido?: Partial<BackendPedido> | null): Pick<Place, 'price' | 'paymentStatus' | 'isPaid'> {
  const anyPedido = (pedido || {}) as any;
  const price = Number(anyPedido.total ?? anyPedido.valor_total ?? anyPedido.valor ?? 0) || 0;
  const isPaid = String(anyPedido.status_pagamento || '').toLowerCase().trim() === 'pago';
  return { price, paymentStatus: isPaid ? 'pago' : 'pendente', isPaid };
}

export type RoutePointKey = 'pickup' | 'exchange' | 'delivery';

function parseOrderExtraItems(pedido?: BackendPedido | null): Record<string, unknown> {
  const raw = pedido?.itens_extras;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapPriceItems(value: unknown): Place['priceItems'] {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const data = item as Record<string, unknown>;
    const amount = finiteNumber(data.value);
    if (!data.id || !data.name || amount === undefined) return [];
    const category = ['coleta', 'transporte', 'entrega', 'extra'].includes(String(data.category))
      ? String(data.category) as 'coleta' | 'transporte' | 'entrega' | 'extra'
      : undefined;
    return [{
      id: String(data.id),
      name: String(data.name),
      value: amount,
      ...(category ? { category } : {}),
      ...(typeof data.isRemovable === 'boolean' ? { isRemovable: data.isRemovable } : {})
    }];
  });
  return items.length ? items : undefined;
}

function mapDiscountItems(value: unknown): Place['discountItems'] {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const data = item as Record<string, unknown>;
    const amount = finiteNumber(data.value);
    if (!data.id || !data.name || amount === undefined) return [];
    return [{
      id: String(data.id),
      name: String(data.name),
      value: amount,
      ...(typeof data.isRemovable === 'boolean' ? { isRemovable: data.isRemovable } : {})
    }];
  });
  return items.length ? items : undefined;
}

function mapPaymentCondition(value: unknown): PaymentConditionType | undefined {
  const conditions: PaymentConditionType[] = ['antes_entrega', 'depois_entrega', 'semanal', 'quinzenal', 'mensal'];
  return conditions.includes(value as PaymentConditionType) ? value as PaymentConditionType : undefined;
}

export function persistedMapOrderDetails(pedido: BackendPedido): Pick<
  Place,
  | 'packageType'
  | 'priceItems'
  | 'discountItems'
  | 'totalDiscounts'
  | 'scheduledTime'
  | 'scheduledTimeMode'
  | 'packageSize'
  | 'volumesCount'
  | 'weightKg'
  | 'dimensions'
  | 'isFragile'
  | 'paymentCondition'
  | 'paymentAdjustmentType'
  | 'paymentAdjustmentValue'
  | 'paymentAdjustmentMode'
> {
  const extra = parseOrderExtraItems(pedido);
  const length = pedido.mercadoria_comprimento;
  const width = pedido.mercadoria_largura;
  const height = pedido.mercadoria_altura;
  const dimensions = length || width || height
    ? `${length || '-'}x${width || '-'}x${height || '-'}cm`
    : undefined;
  const adjustmentType = ['desconto', 'acrescimo', 'nenhum'].includes(String(extra.paymentAdjustmentType))
    ? String(extra.paymentAdjustmentType) as 'desconto' | 'acrescimo' | 'nenhum'
    : undefined;
  const adjustmentMode = ['percent', 'fixed'].includes(String(extra.paymentAdjustmentMode))
    ? String(extra.paymentAdjustmentMode) as 'percent' | 'fixed'
    : undefined;
  const scheduledTimeMode = ['ate', 'partir'].includes(String(extra.scheduledTimeMode))
    ? String(extra.scheduledTimeMode) as 'ate' | 'partir'
    : undefined;
  const volumeCount = finiteNumber(pedido.mercadoria_quantidade ?? extra.volumesCount);

  return {
    packageType: pedido.mercadoria_nome || 'caixa',
    ...(mapPriceItems(extra.priceItems) ? { priceItems: mapPriceItems(extra.priceItems) } : {}),
    ...(mapDiscountItems(extra.discountItems) ? { discountItems: mapDiscountItems(extra.discountItems) } : {}),
    ...(finiteNumber(pedido.desconto) !== undefined ? { totalDiscounts: finiteNumber(pedido.desconto) } : {}),
    ...(typeof extra.scheduledTime === 'string' ? { scheduledTime: extra.scheduledTime } : {}),
    ...(scheduledTimeMode ? { scheduledTimeMode } : {}),
    ...(typeof extra.packageSize === 'string' ? { packageSize: extra.packageSize } : {}),
    ...(volumeCount !== undefined ? { volumesCount: volumeCount } : {}),
    ...(pedido.mercadoria_peso ? { weightKg: String(pedido.mercadoria_peso) } : {}),
    ...(dimensions ? { dimensions } : {}),
    ...(pedido.mercadoria_fragil === true || Number(pedido.mercadoria_fragil) === 1 ? { isFragile: true } : {}),
    ...(mapPaymentCondition(extra.paymentCondition) ? { paymentCondition: mapPaymentCondition(extra.paymentCondition) } : {}),
    ...(adjustmentType ? { paymentAdjustmentType: adjustmentType } : {}),
    ...(finiteNumber(extra.paymentAdjustmentValue) !== undefined
      ? { paymentAdjustmentValue: finiteNumber(extra.paymentAdjustmentValue) }
      : {}),
    ...(adjustmentMode ? { paymentAdjustmentMode: adjustmentMode } : {})
  };
}

export function getRoutePointMetadata(pedido: BackendPedido, point: RoutePointKey, includeLegacySeller = false) {
  const extra = parseOrderExtraItems(pedido);
  const visibilityValue = pedido[`${point}Visibility`] ?? extra[`${point}Visibility`] ??
    pedido.orderVisibility ?? extra.orderVisibility;
  const operation = point === 'pickup' ? 'coleta' : point === 'exchange' ? 'troca' : 'entrega';
  const visibility = visibilityValue === 'privado' ? 'privado' as const : visibilityValue === 'publico' ? 'publico' as const : undefined;
  const legacyDriver = extractDriverAssignmentFromPedido(pedido, operation);
  const sharedDriverId = point !== 'exchange' ? extra.assignedDriverId : undefined;
  const driverId = pedido[`${point}AssignedDriverId`] ?? extra[`${point}AssignedDriverId`] ??
    sharedDriverId ??
    legacyDriver.driverId;
  const driverName = pedido[`${point}AssignedDriverName`] ?? extra[`${point}AssignedDriverName`] ??
    legacyDriver.driverName;
  const driverPhone = pedido[`${point}AssignedDriverPhone`] ?? extra[`${point}AssignedDriverPhone`] ??
    (point !== 'exchange' ? extra.assignedDriverPhone : undefined) ??
    legacyDriver.driverPhone;

  const accepted = Boolean((pedido as any).acceptedByDriver || extra.acceptedByDriver);
  const isPublic = visibility === 'publico' && !accepted;
  const effectiveVisibility = accepted
    ? 'privado' as const
    : (visibility || (driverId ? 'privado' as const : 'publico' as const));

  const sellerName = pedido[`${point}SellerName`] ?? extra[`${point}SellerName`] ??
    (includeLegacySeller ? extra.sellerName : undefined) ??
    (point === 'pickup' ? pedido.coleta_responsavel || pedido.coleta_contato
      : point === 'exchange' ? pedido.troca_responsavel || pedido.troca_contato
        : pedido.entrega_responsavel || pedido.entrega_contato);
  const sellerPhone = pedido[`${point}SellerPhone`] ?? extra[`${point}SellerPhone`] ??
    (includeLegacySeller ? extra.sellerPhone : undefined) ??
    (point === 'pickup' ? pedido.coleta_responsavel_phone || pedido.coleta_phone
      : point === 'exchange' ? pedido.troca_responsavel_phone || pedido.troca_phone
        : pedido.entrega_responsavel_phone || pedido.entrega_phone);

  return {
    visibility: effectiveVisibility,
    driverId: isPublic || driverId == null ? undefined : String(driverId),
    driverName: isPublic || driverName == null ? undefined : String(driverName),
    driverPhone: isPublic || driverPhone == null ? undefined : String(driverPhone),
    acceptedByDriver: accepted,
    sellerName: sellerName == null ? undefined : String(sellerName),
    sellerPhone: sellerPhone == null ? undefined : String(sellerPhone)
  };
}
