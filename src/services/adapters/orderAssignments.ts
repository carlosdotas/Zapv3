import type { OperationType } from '../../types/map';

export interface ExtractedDriverAssignment {
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
}

/**
 * Extrai o motorista atribuído à encomenda a partir dos campos do banco de dados de acordo com a operação:
 * - Para COLETA: coleta_user_id, coleta_user_nome, coleta_motoristas
 * - Para ENTREGA: entrega_user_id, entrega_user_nome, entrega_motoristas
 * - Para TROCA: troca_user_id ou entrega_user_id
 * 
 * Regra de Ouro EncomendasZap: O motorista que faz a coleta NÃO é o da entrega.
 * Cada maker tem seu próprio motorista definido individualmente.
 */
export function extractDriverAssignmentFromPedido(
  pedido?: any, 
  operationType?: OperationType | string
): ExtractedDriverAssignment {
  if (!pedido) return {};

  const op = operationType || 'coleta';
  let rawId: string | number | undefined;
  let rawName: string | undefined;

  if (op === 'coleta') {
    rawId = pedido.coleta_user_id;
    rawName = pedido.coleta_user_nome;
    if (!rawId && pedido.coleta_motoristas) {
      try {
        const motoristasStr = String(pedido.coleta_motoristas).trim();
        if (motoristasStr.startsWith('[')) {
          const parsed = JSON.parse(motoristasStr);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
            rawId = parsed[0];
          }
        }
      } catch {}
    }
  } else if (op === 'entrega' || op === 'retorno') {
    rawId = pedido.entrega_user_id;
    rawName = pedido.entrega_user_nome;
    if (!rawId && pedido.entrega_motoristas) {
      try {
        const motoristasStr = String(pedido.entrega_motoristas).trim();
        if (motoristasStr.startsWith('[')) {
          const parsed = JSON.parse(motoristasStr);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
            rawId = parsed[0];
          }
        }
      } catch {}
    }
  } else if (op === 'troca') {
    rawId = pedido.troca_user_id || pedido.entrega_user_id;
    rawName = pedido.troca_user_nome || pedido.entrega_user_nome;
    if (!rawId && pedido.troca_motoristas) {
      try {
        const motoristasStr = String(pedido.troca_motoristas).trim();
        if (motoristasStr.startsWith('[')) {
          const parsed = JSON.parse(motoristasStr);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
            rawId = parsed[0];
          }
        }
      } catch {}
    }
  }

  // Verifica cache local por chave específica do marcador (ex: pedido-123-coleta ou 123_coleta)
  if (!rawId && pedido.id) {
    try {
      const rawLocal = localStorage.getItem('encomendaszap_order_driver_assignments');
      if (rawLocal) {
        const map = JSON.parse(rawLocal);
        const specificKey = `pedido-${pedido.id}-${op}`;
        const opKey = `${pedido.id}_${op}`;
        const saved = map[specificKey] || map[opKey];
        if (saved && saved.driverId) {
          rawId = saved.driverId;
          if (!rawName) rawName = saved.driverName;
          if (saved.driverPhone && !pedido.motorista_telefone) {
            pedido.motorista_telefone = saved.driverPhone;
          }
        }
      }
    } catch {}
  }

  const cleanId = rawId ? String(rawId).replace(/\D/g, '') : undefined;
  const rawPhone = pedido.motorista_telefone || pedido.motorista_phone || undefined;

  return {
    driverId: cleanId,
    driverName: rawName || (cleanId ? `Motorista #${cleanId}` : undefined),
    driverPhone: rawPhone ? String(rawPhone) : undefined
  };
}
