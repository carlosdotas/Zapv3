import type { Express } from 'express';
import { prisma } from '../db';
import { resolveCaller } from '../access';
import { toInt, iso } from '../mappers';
import { route } from '../http/registerRoute';
import { pedidosToBackend } from './support/orderSupport';
import { earningDay } from './support/earningsSupport';

export function registerFinancialRoutes(app: Express) {
route(app, '/financial/payable/list', async (req, res, body) => {
    const caller = await resolveCaller(req, body);
    if (!caller) {
      res.status(401).json({ success: false, message: 'Autenticação necessária.' });
      return;
    }

    const driverKey = body.driver_id ? String(body.driver_id).trim() : undefined;
    const paidFilter = body.paid !== undefined ? (body.paid === true || body.paid === 'true') : undefined;
    const from = earningDay(body.from);
    const to = earningDay(body.to);
    const search = String(body.busca || body.search || '').trim().toLowerCase();

    const where: any = {};
    if (caller.role === 'motorista') {
      where.driver_key = String(caller.id);
    } else if (driverKey && driverKey !== 'all') {
      where.driver_key = driverKey;
    }

    if (paidFilter !== undefined) {
      where.paid = paidFilter;
    }

    if (from || to) {
      where.day = {};
      if (from) where.day.gte = from;
      if (to) where.day.lte = to;
    }

    const rows = await prisma.driver_earnings.findMany({
      where,
      orderBy: [{ day: 'desc' }, { id: 'desc' }],
      take: 2000
    });

    // Mapeia nomes e contatos de motoristas
    const driverKeys = Array.from(new Set(rows.map(r => r.driver_key).filter(Boolean)));
    const numericKeys = driverKeys.map(k => toInt(k)).filter(Boolean) as number[];
    const users = numericKeys.length ? await prisma.users.findMany({ where: { id: { in: numericKeys } } }) : [];
    const userMap = new Map<string, any>();
    users.forEach(u => userMap.set(String(u.id), u));

    let items = rows.map(r => {
      const u = userMap.get(r.driver_key);
      const driverName = u ? (u.full_name || u.name) : `Motorista #${r.driver_key}`;
      const driverPhone = u ? u.phone : '';
      return {
        id: r.id,
        driver_key: r.driver_key,
        driver_name: driverName,
        driver_phone: driverPhone,
        day: r.day,
        order_key: r.order_key,
        order_id: r.order_key ? r.order_key.split('_')[0] : undefined,
        operation: r.operation || 'entrega',
        label: r.label || undefined,
        place_name: r.place_name || undefined,
        customer_name: r.customer_name || undefined,
        address: r.address || undefined,
        status: r.status,
        price: r.price || 0,
        paid: Boolean(r.paid),
        paid_at: iso(r.paid_at)
      };
    });

    if (search) {
      items = items.filter(i =>
        (i.driver_name && i.driver_name.toLowerCase().includes(search)) ||
        (i.place_name && i.place_name.toLowerCase().includes(search)) ||
        (i.customer_name && i.customer_name.toLowerCase().includes(search)) ||
        (i.address && i.address.toLowerCase().includes(search)) ||
        (i.order_key && i.order_key.toLowerCase().includes(search))
      );
    }

    // Calcula subtotais
    let unpaidTotal = 0;
    let paidTotal = 0;
    items.forEach(i => {
      if (i.paid) paidTotal += i.price;
      else unpaidTotal += i.price;
    });

    res.json({
      success: true,
      data: items,
      subtotal_unpaid: unpaidTotal,
      subtotal_paid: paidTotal,
      total_count: items.length
    });
  });

route(app, '/financial/payable/settle', async (req, res, body) => {
    const caller = await resolveCaller(req, body);
    if (!caller || caller.role === 'motorista') {
      res.status(403).json({ success: false, message: 'Apenas administradores podem dar baixa em pagamentos.' });
      return;
    }

    const ids: number[] = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n: number) => !isNaN(n))
      : body.id ? [Number(body.id)] : [];

    if (!ids.length) {
      res.status(400).json({ success: false, message: 'ID ou lista de IDs obrigatórios.' });
      return;
    }

    const paid = body.paid !== false; // default true
    const paid_at = paid ? new Date() : null;

    const result = await prisma.driver_earnings.updateMany({
      where: { id: { in: ids } },
      data: { paid, paid_at }
    });

    res.json({
      success: true,
      data: { count: result.count, paid, paid_at: iso(paid_at) },
      message: paid ? 'Baixa realizada com sucesso!' : 'Baixa revertida com sucesso!'
    });
  });

route(app, '/financial/receivable/list', async (req, res, body) => {
    const caller = await resolveCaller(req, body);
    if (!caller) {
      res.status(401).json({ success: false, message: 'Autenticação necessária.' });
      return;
    }

    const clientId = toInt(body.client_id);
    const clientName = body.client_name ? String(body.client_name).trim().toLowerCase() : undefined;
    const paidFilter = body.status ? String(body.status).toLowerCase() : undefined;
    const from = earningDay(body.from);
    const to = earningDay(body.to);
    const search = String(body.busca || body.search || '').trim().toLowerCase();

    const where: any = {};
    if (clientId) {
      where.client_id = clientId;
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const rows = await prisma.orders.findMany({
      where,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: 2000
    });

    const enriched = await pedidosToBackend(rows);
    let items = enriched.map(o => {
      const isPaid = String(o.status_pagamento || '').toLowerCase() === 'pago';
      return {
        id: o.id,
        order_id: o.id,
        code: String(o.orderCode || o.codigo || `EZ-${o.id}-GO`),
        client_id: o.cliente_id || null,
        client_name: o.cliente || 'Cliente',
        client_phone: o.cliente_telefone || o.telefone || '',
        seller_name: o.vendedor_nome || o.responsavel_nome || '',
        seller_phone: o.vendedor_telefone || o.responsavel_telefone || '',
        date: String(o.data || o.date || '').slice(0, 10),
        total: Number(o.total || o.valor_total || 0),
        base_value: Number(o.valor_base || o.total || 0),
        discount: Number(o.desconto || 0),
        payment_status: isPaid ? 'pago' : 'nao_pago',
        payment_method: o.forma_pagamento || null,
        paid_at: iso(o.paid_at || o.pago_em),
        orig_name: o.coleta_nome || o.coleta_local || o.orig_name || '',
        dest_name: o.entrega_nome || o.entrega_local || o.dest_name || '',
        tipo_encomenda: o.tipo_encomenda || 'entrega',
        etapa: o.etapa || 'novo'
      };
    });

    // Filtro por status de pagamento (default para contas não pagas/pendentes se solicitado)
    if (paidFilter === 'unpaid' || paidFilter === 'nao_pago' || paidFilter === 'pendente') {
      items = items.filter(i => i.payment_status !== 'pago');
    } else if (paidFilter === 'paid' || paidFilter === 'pago') {
      items = items.filter(i => i.payment_status === 'pago');
    }

    if (clientName) {
      items = items.filter(i => i.client_name.toLowerCase().includes(clientName));
    }

    if (search) {
      items = items.filter(i =>
        i.client_name.toLowerCase().includes(search) ||
        i.code.toLowerCase().includes(search) ||
        i.orig_name.toLowerCase().includes(search) ||
        i.dest_name.toLowerCase().includes(search) ||
        String(i.order_id).includes(search)
      );
    }

    // Calcula subtotais
    let unpaidTotal = 0;
    let paidTotal = 0;
    items.forEach(i => {
      if (i.payment_status === 'pago') paidTotal += i.total;
      else unpaidTotal += i.total;
    });

    res.json({
      success: true,
      data: items,
      subtotal_unpaid: unpaidTotal,
      subtotal_paid: paidTotal,
      total_count: items.length
    });
  });

route(app, '/financial/receivable/settle', async (req, res, body) => {
    const caller = await resolveCaller(req, body);
    if (!caller || caller.role === 'motorista') {
      res.status(403).json({ success: false, message: 'Apenas administradores podem dar baixa em recebimentos.' });
      return;
    }

    const ids: number[] = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n: number) => !isNaN(n))
      : body.id ? [Number(body.id)] : [];

    if (!ids.length) {
      res.status(400).json({ success: false, message: 'ID ou lista de IDs obrigatórios.' });
      return;
    }

    const paid = body.paid !== false; // default true
    const paymentStatus = paid ? 'pago' : 'nao_pago';
    const paidAt = paid ? new Date() : null;
    const paymentMethod = body.payment_method ? String(body.payment_method) : undefined;

    const data: any = {
      payment_status: paymentStatus,
      paid_at: paidAt
    };
    if (paymentMethod) {
      data.payment_method = paymentMethod;
    }

    const result = await prisma.orders.updateMany({
      where: { id: { in: ids } },
      data
    });

    res.json({
      success: true,
      data: { count: result.count, payment_status: paymentStatus, paid_at: iso(paidAt) },
      message: paid ? 'Baixa do pedido confirmada com sucesso!' : 'Baixa revertida com sucesso!'
    });
  });
}
