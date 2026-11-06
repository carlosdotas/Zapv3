import type { Express, Request, Response } from 'express';
import { prisma } from '../db';
import { parseRawJsonBody } from '../http/parseRawJsonBody';
import { parseExtra, pedidoToBackend, toInt } from '../mappers';
import { canAssignCollectedOrder, collectionOwnership } from '../../shared/collectionOwnership';
import { notifyOrderProgress, notifyUser } from '../notifications';
import { resolveCaller, isPrivileged, isAssignmentMine, isConfirmedDriverClaim, assignmentsVisibleTo, canCallerSeeOrder, activeOrderPoint } from '../access';
import { assignmentOrderNumber, sameAssignmentOperation } from '../assignmentKeys';
import type { RealtimeServices, OrderAssignmentData } from './types';
import { opOfKey, numOfKey } from './legacyKeys';

export function registerAssignmentRoutes(app: Express, { noCache, serializeAssignment, activeAssignments, cancelUrgentOffer, deps, broadcast, urgentOffers, sendToUser, sendNextUrgentOffer, persistAssignment }: Pick<RealtimeServices, 'noCache' | 'serializeAssignment' | 'activeAssignments' | 'cancelUrgentOffer' | 'deps' | 'broadcast' | 'urgentOffers' | 'sendToUser' | 'sendNextUrgentOffer' | 'persistAssignment'>) {
  app.get('/api/realtime/assignments', async (req: Request, res: Response) => {
    noCache(res);
    const caller = await resolveCaller(req, parseRawJsonBody(req));
    res.json({ success: true, data: assignmentsVisibleTo(caller) });
  });

  app.post('/api/realtime/assign-driver', async (req: Request, res: Response) => {
    const body = parseRawJsonBody(req);
    const { orderId, driverId, driverName, driverPhone, vehicleType, claim } = body;
    if (!orderId || !driverId) {
      res.status(400).json({ success: false, message: 'orderId e driverId são obrigatórios' });
      return;
    }
    await serializeAssignment(assignmentOrderNumber(String(orderId)) || String(orderId), async () => {
    try {
    const caller = await resolveCaller(req, body);
    if (!caller) {
      res.status(401).json({ success: false, message: 'Faça login para atribuir pedidos.' });
      return;
    }
    // Motorista só pode aceitar o pedido para si mesmo; quem direciona para outros é admin/atendente
    if (!isPrivileged(caller) && !(caller.role === 'motorista' && isAssignmentMine({ driverId, driverPhone }, caller))) {
      res.status(403).json({ success: false, message: 'Sem permissão para atribuir este pedido.' });
      return;
    }
    const numericOrderId = toInt(assignmentOrderNumber(String(orderId)));
    if (numericOrderId) {
      const order = await prisma.orders.findUnique({ where: { id: numericOrderId } });
      if (!order) {
        res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        return;
      }
      if (order) {
        const owner = collectionOwnership(pedidoToBackend(order));
        if (!canAssignCollectedOrder(owner, String(driverId), Boolean(claim))) {
          res.status(403).json({ success: false, message: 'Após a coleta, o pedido fica reservado a quem coletou.' });
          return;
        }
        if (caller.role === 'motorista' && !canCallerSeeOrder(pedidoToBackend(order), caller)) {
          res.status(409).json({ success: false, message: 'Este pedido não está disponível para você.' });
          return;
        }
        const activeOperation = { pickup: 'coleta', exchange: 'troca', delivery: 'entrega' }[activeOrderPoint(pedidoToBackend(order))];
        if (caller.role === 'motorista' && opOfKey(String(orderId)) && opOfKey(String(orderId)) !== activeOperation) {
          res.status(409).json({ success: false, message: 'Esta etapa do pedido não está ativa.' });
          return;
        }
      }
    }
    // Aceite de pedido: se outro motorista já aceitou (em qualquer chave do mesmo pedido/operação), recusa
    if (claim || !isPrivileged(caller)) {
      for (const [key, current] of activeAssignments) {
        if (!current?.driverId || isAssignmentMine(current, caller)) continue;
        if (sameAssignmentOperation(key, String(orderId))) {
          res.status(409).json({ success: false, message: 'Este pedido já foi aceito por outro motorista.' });
          return;
        }
      }
    }
    let orderUpdate: any = null;
    if (numericOrderId) {
        const orderRow = await prisma.orders.findUnique({ where: { id: numericOrderId } });
        if (orderRow) {
          const extra = parseExtra(orderRow.extra);
          const op = opOfKey(String(orderId));
          const numDriverId = caller.role === 'motorista' ? caller.id : toInt(driverId);
          const storedDriverId = caller.role === 'motorista' ? String(caller.id) : String(driverId);
          const point = op === 'coleta' ? 'pickup' : op === 'troca' ? 'exchange' : op === 'entrega' ? 'delivery' : null;
          if (!point || point === activeOrderPoint(pedidoToBackend(orderRow))) {
            extra.assignedDriverId = storedDriverId;
            if (driverName) extra.assignedDriverName = String(driverName); else delete extra.assignedDriverName;
            if (driverPhone) extra.assignedDriverPhone = String(driverPhone); else delete extra.assignedDriverPhone;
            extra.acceptedByDriver = isConfirmedDriverClaim(caller, claim);
            extra.orderVisibility = 'privado';
            delete extra.motorista_id;
            delete extra.motorista_nome;
            delete extra.motorista_telefone;
          }

          const updateData: any = {};
          if (op === 'coleta') {
            if (numDriverId) {
              updateData.collector_id = numDriverId;
              updateData.orig_drivers = JSON.stringify([numDriverId]);
            }
            extra.pickupAssignedDriverId = storedDriverId;
            if (driverName) extra.pickupAssignedDriverName = String(driverName); else delete extra.pickupAssignedDriverName;
            if (driverPhone) extra.pickupAssignedDriverPhone = String(driverPhone); else delete extra.pickupAssignedDriverPhone;
            extra.pickupVisibility = 'privado';
          } else if (op === 'entrega') {
            if (numDriverId) {
              updateData.dest_drivers = JSON.stringify([numDriverId]);
            }
            extra.deliveryAssignedDriverId = storedDriverId;
            if (driverName) extra.deliveryAssignedDriverName = String(driverName); else delete extra.deliveryAssignedDriverName;
            if (driverPhone) extra.deliveryAssignedDriverPhone = String(driverPhone); else delete extra.deliveryAssignedDriverPhone;
            extra.deliveryVisibility = 'privado';
          } else if (op === 'troca') {
            extra.exchangeAssignedDriverId = storedDriverId;
            if (driverName) extra.exchangeAssignedDriverName = String(driverName); else delete extra.exchangeAssignedDriverName;
            if (driverPhone) extra.exchangeAssignedDriverPhone = String(driverPhone); else delete extra.exchangeAssignedDriverPhone;
            extra.exchangeVisibility = 'privado';
          } else {
            if (numDriverId) {
              updateData.collector_id = numDriverId;
              updateData.orig_drivers = JSON.stringify([numDriverId]);
              updateData.dest_drivers = JSON.stringify([numDriverId]);
            }
          }
          updateData.extra = JSON.stringify(extra);
          orderUpdate = updateData;
        }
    }
    const assignment: OrderAssignmentData = {
      orderId: String(orderId),
      assignedAt: Date.now(),
      driverId: caller.role === 'motorista' ? String(caller.id) : String(driverId),
      driverName: driverName || undefined,
      driverPhone: driverPhone || undefined,
      vehicleType: vehicleType || undefined,
      acceptedByDriver: isConfirmedDriverClaim(caller, claim)
    };
    const aliases = Array.from(activeAssignments.keys()).filter(key => sameAssignmentOperation(key, String(orderId)) && key !== String(orderId));
    await prisma.$transaction(async tx => {
      if (numericOrderId && orderUpdate) await tx.orders.update({ where: { id: numericOrderId }, data: orderUpdate });
      if (aliases.length) await tx.assignments.deleteMany({ where: { order_key: { in: aliases } } });
      await tx.assignments.upsert({
        where: { order_key: String(orderId) },
        create: { order_key: String(orderId), data: JSON.stringify(assignment), assigned_at: assignment.assignedAt },
        update: { data: JSON.stringify(assignment), assigned_at: assignment.assignedAt }
      });
    });
    aliases.forEach(key => activeAssignments.delete(key));
    activeAssignments.set(String(orderId), assignment);
    cancelUrgentOffer(String(orderId));

    const opLabel = opOfKey(String(orderId));
    const who = driverName || `Motorista ${driverId}`;
    if (!isPrivileged(caller)) void notifyOrderProgress(
      numOfKey(String(orderId)),
      { type: 'aceito', title: `Pedido #${numOfKey(String(orderId))} aceito`, message: `${who} aceitou ${opLabel ? `a ${opLabel} do ` : 'o '}pedido #${numOfKey(String(orderId))}.` },
      caller.id
    );
    const targetId = toInt(driverId);
    if (isPrivileged(caller) && targetId && targetId !== caller.id) {
      void notifyUser(targetId, {
        type: 'direcionado', title: 'Pedido direcionado a você',
        message: `O pedido #${numOfKey(String(orderId))}${opLabel ? ` (${opLabel})` : ''} foi direcionado a você.`,
        orderId: toInt(numOfKey(String(orderId)))
      });
    }
    try {
      deps?.notifyOrdersChanged?.();
      broadcast({ type: 'orders:changed', at: Date.now() });
    } catch {}

    res.json({ success: true, data: assignment });
    } catch (err) {
      console.error('[Realtime] Falha ao atribuir pedido:', err);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Não foi possível atribuir o pedido.' });
    }
    });
  });

  app.post('/api/realtime/urgent-offer/respond', async (req: Request, res: Response) => {
    try {
      const body = parseRawJsonBody(req);
      const caller = await resolveCaller(req, body);
      if (!caller || caller.role !== 'motorista') {
        res.status(caller ? 403 : 401).json({ success: false, message: 'Apenas motoristas autenticados podem responder ao convite.' });
        return;
      }
      const state = urgentOffers.get(String(body.offerId || ''));
      if (!state || state.currentDriverId !== String(caller.id) || !state.expiresAt || state.expiresAt <= Date.now()) {
        res.status(404).json({ success: false, message: 'Este convite não está mais ativo para você.' });
        return;
      }
      if (body.accepted === true) {
        res.json({ success: true });
        return;
      }
      if (body.accepted !== false) {
        res.status(400).json({ success: false, message: 'Resposta inválida.' });
        return;
      }
      if (state.timeout) clearTimeout(state.timeout);
      sendToUser(caller.id, { type: 'urgent:cancel', offerId: state.orderKey });
      state.attemptedDriverIds.add(String(caller.id));
      if (state.currentDriverKey) state.attemptedDriverIds.add(state.currentDriverKey);
      state.currentDriverId = undefined;
      state.currentDriverKey = undefined;
      state.expiresAt = undefined;
      const settingsRow = await prisma.app_settings.findUnique({ where: { key: 'global_config' } });
      const settings = settingsRow ? parseExtra(settingsRow.value) : {};
      const configuredRadius = Number(settings.operation?.urgentNotificationRadiusKm);
      const radiusKm = Number.isFinite(configuredRadius) ? Math.min(50, Math.max(1, configuredRadius)) : 5;
      sendNextUrgentOffer(state, radiusKm);
      res.json({ success: true });
    } catch (error) {
      console.error('[Urgent Dispatch] Falha ao responder convite:', error);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Não foi possível responder ao convite.' });
    }
  });

  app.post('/api/realtime/en-route', async (req: Request, res: Response) => {
    const body = parseRawJsonBody(req);
    const { orderIds, enRoute } = body;
    if (!Array.isArray(orderIds)) {
      res.status(400).json({ success: false, message: 'orderIds é obrigatório' });
      return;
    }
    const caller = await resolveCaller(req, body);
    if (!caller) {
      res.status(401).json({ success: false, message: 'Faça login para continuar.' });
      return;
    }
    for (const id of orderIds) {
      const current = activeAssignments.get(String(id));
      if (!current) continue;
      if (!isPrivileged(caller) && !isAssignmentMine(current, caller)) continue;
      const assignment = { ...current, enRoute: Boolean(enRoute) };
      activeAssignments.set(String(id), assignment);
      void persistAssignment(String(id), assignment);
    }
    res.json({ success: true });
  });

  app.post('/api/realtime/unassign-driver', async (req: Request, res: Response) => {
    const body = parseRawJsonBody(req);
    const { orderId } = body;
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId é obrigatório' });
      return;
    }
    await serializeAssignment(assignmentOrderNumber(String(orderId)) || String(orderId), async () => {
    try {
    const caller = await resolveCaller(req, body);
    if (!caller) {
      res.status(401).json({ success: false, message: 'Faça login para continuar.' });
      return;
    }
    const matches = Array.from(activeAssignments.entries()).filter(([key]) => sameAssignmentOperation(key, String(orderId)));
    if (!isPrivileged(caller) && (!matches.length || matches.some(([, assignment]) => !isAssignmentMine(assignment, caller)))) {
      res.status(403).json({ success: false, message: 'Este pedido pertence a outro motorista.' });
      return;
    }

    const numericOrderId = toInt(assignmentOrderNumber(String(orderId)));
    let orderUpdate: any = null;
    if (numericOrderId) {
        const orderRow = await prisma.orders.findUnique({ where: { id: numericOrderId } });
        if (orderRow) {
          if (collectionOwnership(pedidoToBackend(orderRow)).collectionRestricted) {
            res.status(409).json({ success: false, message: 'Após a coleta, o pedido permanece reservado ao motorista que coletou.' });
            return;
          }
          const extra = parseExtra(orderRow.extra);
          const op = opOfKey(String(orderId));
          const point = op === 'coleta' ? 'pickup' : op === 'troca' ? 'exchange' : op === 'entrega' ? 'delivery' : null;
          if (point) {
            extra[`${point}Visibility`] = 'publico';
            delete extra[`${point}AssignedDriverId`];
            delete extra[`${point}AssignedDriverName`];
            delete extra[`${point}AssignedDriverPhone`];
          }
          if (!point || point === activeOrderPoint(pedidoToBackend(orderRow))) {
            extra.orderVisibility = 'publico';
            delete extra.assignedDriverId;
            delete extra.assignedDriverName;
            delete extra.assignedDriverPhone;
            delete extra.acceptedByDriver;
            delete extra.motorista_id;
            delete extra.motorista_nome;
            delete extra.motorista_telefone;
          }

          const updateData: any = {};
          if (op === 'coleta' || !op) {
            delete extra.coleta_user_id;
            delete extra.coleta_user_nome;
            updateData.collector_id = null;
            updateData.orig_drivers = '[]';
          }
          if (op === 'entrega' || !op) {
            delete extra.entrega_user_id;
            delete extra.entrega_user_nome;
            updateData.dest_drivers = '[]';
          }
          updateData.extra = JSON.stringify(extra);
          orderUpdate = updateData;
        }
    }
    await prisma.$transaction(async tx => {
      if (numericOrderId && orderUpdate) await tx.orders.update({ where: { id: numericOrderId }, data: orderUpdate });
      if (matches.length) await tx.assignments.deleteMany({ where: { order_key: { in: matches.map(([key]) => key) } } });
    });
    for (const [key] of matches) activeAssignments.delete(key);

    try {
      deps?.notifyOrdersChanged?.();
      broadcast({ type: 'orders:changed', at: Date.now() });
    } catch {}

    res.json({ success: true });
    } catch (err) {
      console.error('[Realtime] Falha ao desvincular pedido:', err);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Não foi possível desvincular o pedido.' });
    }
    });
  });

  app.post('/api/realtime/decline-order', async (req: Request, res: Response) => {
    const body = parseRawJsonBody(req);
    const orderId = toInt(body.orderId);
    const operation = String(body.operation || '').toLowerCase();
    const reason = String(body.reason || '').trim();
    if (!orderId || !['coleta', 'troca', 'entrega'].includes(operation) || reason.length < 5) {
      res.status(400).json({ success: false, message: 'Pedido, etapa e justificativa são obrigatórios.' });
      return;
    }

    await serializeAssignment(String(orderId), async () => {
    try {
    const caller = await resolveCaller(req, body);
    if (!caller || caller.role !== 'motorista') {
      res.status(403).json({ success: false, message: 'Somente o motorista pode recusar o pedido aceito.' });
      return;
    }

    const matchingAssignments = Array.from(activeAssignments.entries()).filter(([key, assignment]) =>
      sameAssignmentOperation(key, `${orderId}_${operation}`) &&
      Boolean(assignment?.driverId)
    );
    const callerClaims = matchingAssignments.filter(([, assignment]) =>
      isAssignmentMine(assignment, caller) && assignment.acceptedByDriver === true
    );
    if (!callerClaims.length) {
      res.status(409).json({ success: false, message: 'O pedido não está mais aceito por este motorista.' });
      return;
    }
    if (matchingAssignments.some(([, assignment]) => !isAssignmentMine(assignment, caller))) {
      res.status(409).json({ success: false, message: 'O pedido possui outra atribuição ativa.' });
      return;
    }

    const order = await prisma.orders.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
      return;
    }
    if (collectionOwnership(pedidoToBackend(order)).collectionRestricted) {
      res.status(409).json({ success: false, message: 'Após a coleta, o pedido permanece reservado ao motorista que coletou.' });
      return;
    }

    const extra = parseExtra(order.extra);
    const point = operation === 'coleta' ? 'pickup' : operation === 'troca' ? 'exchange' : 'delivery';
    extra[`${point}Visibility`] = 'publico';
    for (const suffix of ['AssignedDriverId', 'AssignedDriverName', 'AssignedDriverPhone']) {
      delete extra[`${point}${suffix}`];
    }
    extra.orderVisibility = 'publico';
    delete extra.assignedDriverId;
    delete extra.assignedDriverName;
    delete extra.assignedDriverPhone;
    delete extra.motorista_id;
    delete extra.motorista_nome;
    delete extra.motorista_telefone;
    delete extra.acceptedByDriver;

    const orderPatch: Record<string, unknown> = {
      driver_cancel_reason: reason,
      driver_cancel_at: new Date(),
      driver_cancel_user_id: caller.id
    };
    if (operation === 'coleta' || operation === 'troca') {
      delete extra.coleta_user_id;
      delete extra.coleta_user_nome;
      orderPatch.collector_id = null;
      orderPatch.orig_drivers = '[]';
    }
    if (operation === 'entrega' || operation === 'troca') {
      delete extra.entrega_user_id;
      delete extra.entrega_user_nome;
      orderPatch.dest_drivers = '[]';
    }
    orderPatch.extra = JSON.stringify(extra);

    const keysToClear = matchingAssignments.map(([key]) => key);
    await prisma.$transaction(async tx => {
      await tx.orders.update({ where: { id: orderId }, data: orderPatch });
      if (keysToClear.length) await tx.assignments.deleteMany({ where: { order_key: { in: keysToClear } } });
    });
    keysToClear.forEach(key => activeAssignments.delete(key));

    try {
      deps?.notifyOrdersChanged?.();
      broadcast({ type: 'orders:changed', at: Date.now() });
    } catch {}

    res.json({ success: true, data: { orderId, operation } });
    } catch (error) {
      console.error('[Realtime] Falha ao recusar pedido:', error);
      if (!res.headersSent) res.status(500).json({ success: false, message: 'Não foi possível recusar o pedido.' });
    }
    });
  });



}
