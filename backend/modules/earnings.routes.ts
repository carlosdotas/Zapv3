import type { Express } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db';
import { resolveCaller } from '../access';
import { route } from '../http/registerRoute';
import { earningDay } from './support/earningsSupport';

export function registerEarningsRoutes(app: Express) {
const earningsKey = async (req: Request, res: Response, body: any): Promise<string | null> => {
    const caller = await resolveCaller(req, body);
    if (!caller) {
      res.status(401).json({ success: false, message: 'Faça login para continuar.' });
      return null;
    }
    return caller.role === 'motorista' ? String(caller.id) : String(body.driver_id || '').trim();
  };

route(app, '/driver-earnings/list', async (req, res, body) => {
    const driverKey = await earningsKey(req, res, body);
    if (driverKey === null) return;
    const day = earningDay(body.day);
    if (!driverKey || !day) {
      res.status(400).json({ success: false, message: 'driver_id e day são obrigatórios' });
      return;
    }
    const rows = await prisma.driver_earnings.findMany({ where: { driver_key: driverKey, day }, orderBy: { id: 'asc' } });
    res.json({ success: true, data: rows });
  });

route(app, '/driver-earnings/history', async (req, res, body) => {
    const driverKey = await earningsKey(req, res, body);
    if (driverKey === null) return;
    if (!driverKey) {
      res.status(400).json({ success: false, message: 'driver_id é obrigatório' });
      return;
    }
    const exclude = earningDay(body.exclude_day);
    const from = earningDay(body.from);
    const to = earningDay(body.to);
    const dayFilter: Record<string, string> = {};
    if (exclude) dayFilter.not = exclude;
    if (from) dayFilter.gte = from;
    if (to) dayFilter.lte = to;
    const rows = await prisma.driver_earnings.findMany({
      where: {
        driver_key: driverKey,
        ...(body.collected_only ? { status: 'coletado' } : {}),
        ...(Object.keys(dayFilter).length ? { day: dayFilter } : {})
      },
      orderBy: [{ day: 'desc' }, { id: 'asc' }],
      take: 1000
    });
    const days = new Map<string, any>();
    rows.forEach(r => {
      const d = days.get(r.day) || { day: r.day, accepted: 0, collected: 0, total: 0, paid_count: 0, paid_at: null as Date | null, items: [] as any[] };
      d.accepted += 1;
      if (r.status === 'coletado') d.collected += 1;
      d.total += r.price || 0;
      if (r.paid) {
        d.paid_count += 1;
        if (r.paid_at && (!d.paid_at || r.paid_at > d.paid_at)) d.paid_at = r.paid_at;
      }
      d.items.push(r);
      days.set(r.day, d);
    });
    const data = Array.from(days.values()).map(d => ({ ...d, paid: d.paid_count === d.items.length }));
    res.json({ success: true, data });
  });

route(app, '/driver-earnings/pay', async (req, res, body) => {
    const driverKey = await earningsKey(req, res, body);
    if (driverKey === null) return;
    const day = earningDay(body.day);
    if (!driverKey || !day) {
      res.status(400).json({ success: false, message: 'driver_id e day são obrigatórios' });
      return;
    }
    const paid = body.paid !== false;
    const r = await prisma.driver_earnings.updateMany({
      where: { driver_key: driverKey, day },
      data: { paid, paid_at: paid ? new Date() : null }
    });
    res.json({ success: true, data: { updated: r.count, paid } });
  });

route(app, '/driver-earnings/save', async (req, res, body) => {
    const driverKey = await earningsKey(req, res, body);
    if (driverKey === null) return;
    const day = earningDay(body.day);
    const orderKey = String(body.order_key || '').trim();
    if (!driverKey || !day || !orderKey) {
      res.status(400).json({ success: false, message: 'driver_id, day e order_key são obrigatórios' });
      return;
    }
    const price = Math.max(0, Number(body.price) || 0);
    const status = body.status === 'coletado' ? 'coletado' : 'aceito';
    const common = {
      operation: body.operation ? String(body.operation).slice(0, 20) : null,
      label: body.label ? String(body.label).slice(0, 255) : null,
      place_name: body.place_name ? String(body.place_name).slice(0, 255) : null,
      customer_name: body.customer_name ? String(body.customer_name).slice(0, 255) : null,
      address: body.address ? String(body.address).slice(0, 255) : null,
      status,
      price
    };
    const row = await prisma.driver_earnings.upsert({
      where: { driver_key_day_order_key: { driver_key: driverKey, day, order_key: orderKey } },
      create: { driver_key: driverKey, day, order_key: orderKey, ...common, accepted_at: new Date(), collected_at: status === 'coletado' ? new Date() : null },
      update: { ...common, ...(status === 'coletado' ? { collected_at: new Date() } : {}) }
    });
    res.json({ success: true, data: row });
  });
}
