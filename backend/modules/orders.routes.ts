import type { Express } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { resolveCaller, canCallerSeeOrder, isPrivileged, assignmentStore } from '../access';
import { notifyNewOrder } from '../notifications';
import { hasOrderPhoto, removeOrderPhoto } from '../orderPhotos';
import { canViewDriverCollections, collectionSummary, openDriverCollectionsWhere } from '../driverCollections';
import { collectionOwnership } from '../../shared/collectionOwnership';
import { pedidoToBackend, pedidoFromBackend, cleanPedidoId, todaySaoPaulo, toInt, hasValue } from '../mappers';
import { route } from '../http/registerRoute';
import type { RouteDeps } from '../http/routeTypes';
import { findUserByPhone } from './support/userSupport';
import { findPedido, pedidosToBackend, logStage, NEXT_ETAPA, applyEtapa, searchPedidosWhere } from './support/orderSupport';

export function registerOrdersRoutes(app: Express, deps: RouteDeps) {
route(app, '/pedidos/coletas_motorista', async (req, res, body) => {
    const rawId = String(body.motorista_id ?? '').trim();
    const driverId = /^\d+$/.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isSafeInteger(driverId) || driverId <= 0) {
      res.status(400).json({ success: false, message: 'Motorista inválido.' });
      return;
    }
    const caller = await resolveCaller(req, body);
    if (!canViewDriverCollections(caller, driverId)) {
      res.status(403).json({ success: false, message: 'Não é permitido consultar as coletas deste motorista.' });
      return;
    }
    const page = Math.max(1, parseInt(body.page, 10) || 1);
    const limit = 30;
    const where = openDriverCollectionsWhere(driverId);
    const [rows, total] = await Promise.all([
      prisma.orders.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.orders.count({ where })
    ]);
    const orders = await pedidosToBackend(rows);
    res.json({ success: true, data: orders.map(collectionSummary), page, total, hasMore: page * limit < total });
  });

route(app, '/pedidos/list_pedidos', async (req, res, body) => {
    const where = await searchPedidosWhere(body);
    const etapas: string[] | null = body.etapa
      ? (Array.isArray(body.etapa) ? body.etapa : [body.etapa]).map((e: string) => String(e).toLowerCase())
      : null;
    const limit = Math.min(Math.max(1, parseInt(body.limit, 10) || 2000), 2000);
    const page = Math.max(1, parseInt(body.page, 10) || 1);

    const caller = await resolveCaller(req, body);
    const lightweightFeed = body.active_only === true || body.active_only === 'true' || body.active_only === 1 ||
      body.completed_only === true || body.completed_only === 'true' || body.completed_only === 1;
    if (lightweightFeed && isPrivileged(caller)) {
      const skip = (page - 1) * limit;
      const [rows, total] = await Promise.all([
        prisma.orders.findMany({ where, orderBy: { id: 'desc' }, skip, take: limit }),
        prisma.orders.count({ where })
      ]);
      let data = await pedidosToBackend(rows);
      if (etapas) data = data.filter(o => etapas.includes(String(o.etapa).toLowerCase()));
      res.json({ success: true, data, total, page, limit, hasMore: page * limit < total });
      return;
    }

    const rows = await prisma.orders.findMany({ where, orderBy: { id: 'desc' } });
    let data = await pedidosToBackend(rows);
    // Pedido com motorista definido só aparece para esse motorista
    data = data.filter(o => canCallerSeeOrder(o, caller));
    if (etapas) data = data.filter(o => etapas.includes(String(o.etapa).toLowerCase()));
    const total = data.length;
    res.json({ success: true, data: data.slice((page - 1) * limit, page * limit), total, page, limit, hasMore: page * limit < total });
  });

const orderForbidden = async (req: Request, res: Response, body: any, row: any): Promise<boolean> => {
    if (!row) return false;
    const caller = await resolveCaller(req, body);
    if (caller && caller.role !== 'motorista') return false;
    const [view] = await pedidosToBackend([row]);
    if (canCallerSeeOrder(view, caller)) return false;
    res.status(403).json({ success: false, message: 'Este pedido pertence a outro motorista.' });
    return true;
  };

route(app, '/pedidos/get', async (req, res, body) => {
    const row = await findPedido(body.id ?? body.pedido_id ?? req.query.id);
    if (!row) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      return;
    }
    if (await orderForbidden(req, res, body, row)) return;
    res.json({ success: true, data: (await pedidosToBackend([row]))[0] });
  });

route(app, ['/pedidos/save', '/pedidos/save_pedido'], async (req, res, body) => {
    const callerRole = (req.headers['x-user-role'] as string) || body.caller_role || body.userRole || body.user_role;
    const sessionCaller = await resolveCaller(req, body);
    if (callerRole === 'motorista' || sessionCaller?.role === 'motorista') {
      res.status(403).json({ success: false, message: 'Motoristas não possuem permissão para adicionar ou editar pedidos.' });
      return;
    }

    const hasIdentifier = hasValue(body.id) || hasValue(body.pedido_id);
    const existing = await findPedido(hasValue(body.id) ? body.id : body.pedido_id);
    // id informado que não existe (ex.: id temporário do app) não pode criar um pedido novo duplicado
    if (hasIdentifier && !existing) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      return;
    }
    if (existing && Object.prototype.hasOwnProperty.call(body, 'coleta_user_id')) {
      const owner = collectionOwnership(pedidoToBackend(existing));
      if (owner.collectionRestricted && String(body.coleta_user_id ?? '') !== String(owner.collectionOwnerId ?? '')) {
        res.status(409).json({ success: false, message: 'A coleta já foi registrada e não pode ser atribuída a outro usuário.' });
        return;
      }
    }
    const data = pedidoFromBackend(body, existing);
    let saved;
    if (existing) {
      saved = await prisma.orders.update({ where: { id: existing.id }, data });
      await logStage(existing.id, existing.stage, saved.stage, body.users_id, 'Atualização do pedido');
    } else {
      if (data.client_id === undefined && body.phone) {
        const customer = await findUserByPhone(body.phone);
        if (customer) data.client_id = customer.id;
      }
      saved = await prisma.orders.create({
        data: {
          ...data,
          date: data.date || todaySaoPaulo(),
          client_name: data.client_name || 'Cliente',
          contact_phone: data.contact_phone ?? ''
        }
      });
      await logStage(saved.id, 'novo', saved.stage, body.users_id, 'Pedido criado');
      void notifyNewOrder(saved, sessionCaller?.id ?? toInt(body.users_id));
    }
    deps.notifyOrdersChanged?.();
    res.json({ success: true, data: { id: saved.id }, id: saved.id, message: 'Pedido salvo com sucesso!' });
  });

route(app, '/pedidos/marcar_coleta_entrega', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (await orderForbidden(req, res, body, existing)) return;
    const etapa = String(body.etapa || '');
    const caller = await resolveCaller(req, body);
    if (etapa === 'coletado' && !caller) {
      res.status(401).json({ success: false, message: 'Faça login para registrar a coleta.' });
      return;
    }
    if (existing && etapa === 'coletado' && !hasOrderPhoto(pedidoToBackend(existing).coleta_foto)) {
      res.status(400).json({ success: false, message: 'A foto da coleta é obrigatória para finalizar a coleta.' });
      return;
    }
    const updated = await applyEtapa(existing, etapa, etapa === 'coletado' ? caller?.id : body.user_id, body.usuario_nome || body.user_nome, {
      distance: body.distancia_m,
      lat: body.baixa_lat,
      lng: body.baixa_lng
    });
    if (!updated) {
      if (existing && etapa === 'coletado') {
        res.status(409).json({ success: false, message: 'A coleta já foi registrada ou a etapa mudou. Atualize o pedido.' });
      } else {
        res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      }
      return;
    }
    res.json({ success: true, data: { pedido_id: updated.id, etapa, collection_owner_id: updated.collector_id } });
  });

route(app, '/pedidos/presenca', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      return;
    }
    if (await orderForbidden(req, res, body, existing)) return;
    const op = ['coleta', 'troca', 'entrega'].includes(String(body.operacao)) ? String(body.operacao) : 'coleta';
    const view: any = pedidoToBackend(existing);
    const now = new Date();
    let chegada: string | null = view[`${op}_chegada_em`] || null;
    let espera = Number(view[`${op}_espera_s`]) || 0;
    const desde = view[`${op}_espera_desde`] ? Date.parse(view[`${op}_espera_desde`]) : NaN;
    const gapS = Number.isFinite(desde) ? Math.max(0, (now.getTime() - desde) / 1000) : 0;
    let counting = false;
    const patch: any = {};
    if (body.perto === true || body.perto === 'true') {
      if (!chegada) chegada = now.toISOString();
      espera += gapS;
      counting = true;
      patch[`${op}_espera_desde`] = now.toISOString();
    } else if (Number.isFinite(desde)) {
      espera += Math.min(gapS, 90);
      patch[`${op}_espera_desde`] = '';
    }
    if (chegada) patch[`${op}_chegada_em`] = chegada;
    patch[`${op}_espera_s`] = Math.round(espera);
    if (Object.keys(patch).length) {
      await prisma.orders.update({ where: { id: existing.id }, data: pedidoFromBackend(patch, existing) });
    }
    res.json({ success: true, data: { chegada_em: chegada, espera_s: Math.round(espera), counting } });
  });

route(app, '/pedidos/reverter_baixa', async (req, res, body) => {
    const caller = await resolveCaller(req, body);
    if (!caller || !isPrivileged(caller)) {
      res.status(403).json({ success: false, message: 'Somente admin ou atendente pode voltar uma baixa.' });
      return;
    }
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      return;
    }
    const op = ['coleta', 'troca', 'entrega'].includes(String(body.operacao)) ? String(body.operacao) : 'coleta';
    const target = op === 'coleta' ? 'coletando' : op === 'troca' ? 'trocando' : 'entregando';
    const allowedFrom: Record<string, string[]> = {
      coleta: ['coletado', 'trocando', 'entregando'],
      troca: ['trocado', 'retornando'],
      entrega: ['entregue', 'finalizado']
    };
    const current = String(pedidoToBackend(existing).etapa || '').toLowerCase();
    if (!allowedFrom[op].includes(current)) {
      res.status(409).json({ success: false, message: `A etapa atual (${current}) não permite voltar esta baixa.` });
      return;
    }
    const data: any = pedidoFromBackend({ etapa: target }, existing);
    if (op === 'coleta') {
      data.collected_at = null;
      data.collector_id = null;
    }
    if (op === 'entrega') {
      data.delivered_at = null;
      data.finalized_at = null;
      data.payment_status = 'nao_pago';
    }
    const updated = await prisma.orders.update({ where: { id: existing.id }, data });
    await logStage(existing.id, existing.stage, updated.stage, caller.id, `Baixa de ${op} desfeita por ${caller.role}`);
    await prisma.driver_earnings.updateMany({
      where: { order_key: `${existing.id}_${op}`, status: 'coletado' },
      data: { status: 'aceito', collected_at: null }
    });
    res.json({ success: true, data: { pedido_id: existing.id, etapa: target } });
  });

route(app, '/pedidos/set_etapa', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (await orderForbidden(req, res, body, existing)) return;
    if (existing) {
      const view = pedidoToBackend(existing);
      const next = (NEXT_ETAPA[view.etapa] || (() => 'finalizado'))(view.tipo_encomenda);
      const caller = next === 'coletado' ? await resolveCaller(req, body) : null;
      if (next === 'coletado' && !caller) {
        res.status(401).json({ success: false, message: 'Faça login para registrar a coleta.' });
        return;
      }
      if (next === 'coletado' && !hasOrderPhoto(view.coleta_foto)) {
        res.status(400).json({ success: false, message: 'A foto da coleta é obrigatória para finalizar a coleta.' });
        return;
      }
      const updated = await applyEtapa(existing, next, next === 'coletado' ? caller?.id : body.user_id);
      if (!updated && next === 'coletado') {
        res.status(409).json({ success: false, message: 'A coleta já foi registrada ou a etapa mudou. Atualize o pedido.' });
        return;
      }
    }
    res.json({ success: true });
  });

route(app, '/pedidos/finalizar_pedido', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (await orderForbidden(req, res, body, existing)) return;
    if (existing) await applyEtapa(existing, 'finalizado', body.user_id);
    res.json({ success: true });
  });

route(app, '/pedidos/upload_foto', async (_req, res, body) => {
    const tipo = String(body.tipo || 'coleta').replace(/[^a-z0-9_-]/gi, '');
    const base64Data = body.base64 || body.image || body.foto;
    if (typeof base64Data !== 'string' || !base64Data.startsWith('data:image/')) {
      res.status(400).json({ success: false, message: 'Nenhuma imagem válida foi enviada.' });
      return;
    }
    const photoPath = deps.saveBase64Image(base64Data, `pedidos/${tipo || 'coleta'}`);
    if (!photoPath) {
      res.status(500).json({ success: false, message: 'Não foi possível gravar a foto do pedido.' });
      return;
    }
    res.json({ success: true, data: { path: photoPath } });
  });

route(app, '/pedidos/append_foto', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (await orderForbidden(req, res, body, existing)) return;
    const foto = body.foto;
    const campo = String(body.campo || 'coleta_foto');
    if (!existing) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado para anexar a foto.' });
      return;
    }
    if (!['coleta_foto', 'entrega_foto', 'mercadoria_foto'].includes(campo) || typeof foto !== 'string' || !foto.trim()) {
      res.status(400).json({ success: false, message: 'Foto ou campo inválido.' });
      return;
    }
    if (existing && foto) {
      const current = pedidoToBackend(existing)[campo];
      const list: string[] = [];
      try {
        if (typeof current === 'string' && current.trim().startsWith('[')) list.push(...JSON.parse(current));
        else if (current) list.push(String(current));
      } catch {
        // valor antigo inválido: recomeça a lista
      }
      list.push(foto);
      await prisma.orders.update({ where: { id: existing.id }, data: pedidoFromBackend({ [campo]: JSON.stringify(list) }, existing) });
      deps.notifyOrdersChanged?.();
    }
    res.json({ success: true, data: { path: foto } });
  });

route(app, '/pedidos/remove_foto', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
      return;
    }
    if (await orderForbidden(req, res, body, existing)) return;
    const campo = String(body.campo || '');
    if (!['coleta_foto', 'entrega_foto'].includes(campo) || typeof body.foto !== 'string' || !body.foto.trim()) {
      res.status(400).json({ success: false, message: 'Foto ou campo inválido.' });
      return;
    }
    let remaining: string[];
    try {
      remaining = removeOrderPhoto(pedidoToBackend(existing)[campo], body.foto);
    } catch (error) {
      console.error('[Fotos] Não foi possível remover foto:', error);
      res.status(400).json({ success: false, message: 'Não foi possível ler a lista de fotos do pedido.' });
      return;
    }
    await prisma.orders.update({ where: { id: existing.id }, data: pedidoFromBackend({ [campo]: JSON.stringify(remaining) }, existing) });
    deps.notifyOrdersChanged?.();
    res.json({ success: true });
  });

route(app, '/pedidos/registrar_presenca', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (await orderForbidden(req, res, body, existing)) return;
    if (existing && body.campo) {
      const ts = body.timestamp || new Date().toISOString();
      await prisma.orders.update({ where: { id: existing.id }, data: pedidoFromBackend({ [body.campo]: ts }, existing) });
    }
    res.json({ success: true });
  });

route(app, '/pedidos/ensure_public_token', async (req, res, body) => {
    const existing = await findPedido(body.pedido_id ?? body.id);
    if (await orderForbidden(req, res, body, existing)) return;
    if (!existing) {
      res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      return;
    }
    const token = existing.public_tracking_token || crypto.randomBytes(24).toString('hex');
    if (!existing.public_tracking_token) {
      await prisma.orders.update({ where: { id: existing.id }, data: { public_tracking_token: token } });
    }
    res.json({ success: true, data: { public_tracking_token: token } });
  });

route(app, '/pedidos/delete', async (req, res, body) => {
    const callerRole = (req.headers['x-user-role'] as string) || body.caller_role || body.userRole || body.user_role;
    const sessionCaller = await resolveCaller(req, body);
    if (callerRole === 'motorista' || sessionCaller?.role === 'motorista') {
      res.status(403).json({ success: false, message: 'Motoristas não possuem permissão para excluir pedidos.' });
      return;
    }
    const id = toInt(cleanPedidoId(body.pedido_id ?? body.id ?? req.query.id));
    if (!id) {
      res.json({ success: true, message: 'Pedido local excluído.' });
      return;
    }
    // Exclusão incondicional (qualquer etapa): remove o pedido e tudo que depende dele
    const orderNumber = String(id);
    const keyOf = (key: string) => key.match(/\d+/)?.[0] === orderNumber;
    try {
      try {
        await prisma.order_logs.deleteMany({ where: { order_id: id } });
      } catch {}
      try {
        await prisma.notifications.deleteMany({ where: { order_id: id } });
      } catch {}
      await prisma.orders.deleteMany({ where: { id } });
      for (const key of Array.from(assignmentStore.keys())) {
        if (keyOf(key)) assignmentStore.delete(key);
      }
      const storedKeys = await prisma.assignments.findMany({ select: { order_key: true } });
      const staleKeys = storedKeys.map(row => row.order_key).filter(keyOf);
      if (staleKeys.length) await prisma.assignments.deleteMany({ where: { order_key: { in: staleKeys } } });
      deps.notifyOrdersChanged?.();
    } catch (error) {
      console.error('[pedidos/delete] falha ao excluir pedido', id, error);
      res.status(500).json({ success: false, message: 'Não foi possível excluir o pedido.' });
      return;
    }
    res.json({ success: true, message: 'Pedido excluído com sucesso.' });
  });
}
