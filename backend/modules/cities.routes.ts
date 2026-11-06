import type { Express } from 'express';
import { prisma } from '../db';
import { toInt } from '../mappers';
import { route } from '../http/registerRoute';

export function registerCitiesRoutes(app: Express) {
route(app, '/cidades', async (req, res, body) => {
    const search = String(req.query.search || body.search || '').toLowerCase().trim();
    const [cities, counts] = await Promise.all([
      prisma.config_cities.findMany({ orderBy: { city: 'asc' } }),
      prisma.orders.groupBy({ by: ['orig_city'], _count: { _all: true } })
    ]);
    const byCity = new Map(counts.filter(c => c.orig_city).map(c => [c.orig_city!.toLowerCase(), c._count._all]));
    const data = cities
      .filter(c => !search || c.city.toLowerCase().includes(search))
      .map(c => ({ id: c.id, name: c.city, estado: c.state || 'GO', pedidos_count: byCity.get(c.city.toLowerCase()) || 0 }));
    res.json({ success: true, data });
  });

const toEpoch = (v: any) => {
    if (!v) return Date.now();
    if (v instanceof Date) return v.getTime();
    const d = new Date(v);
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
  };

const cityRecord = (c: any) => ({
    id: String(c.id),
    name: c.city,
    state: c.state || undefined,
    createdAt: toEpoch(c.created_at),
    updatedAt: toEpoch(c.updated_at)
  });

route(app, '/cities', async (_req, res) => {
    const rows = await prisma.config_cities.findMany({ orderBy: { city: 'asc' } });
    res.json({ success: true, data: rows.map(cityRecord) });
  });

route(app, '/cities/save', async (_req, res, body) => {
    const name = String(body.name || body.city || '').trim();
    if (!name) {
      res.status(400).json({ success: false, message: 'Nome da cidade obrigatório' });
      return;
    }
    const state = body.state ? String(body.state).trim() : null;
    const id = toInt(body.id);
    const existing = id ? await prisma.config_cities.findUnique({ where: { id } }) : await prisma.config_cities.findUnique({ where: { city: name } });
    const saved = existing
      ? await prisma.config_cities.update({ where: { id: existing.id }, data: { city: name, state } })
      : await prisma.config_cities.create({ data: { city: name, state } });
    res.json({ success: true, data: cityRecord(saved) });
  });

route(app, '/cities/delete', async (_req, res, body) => {
    const id = toInt(body.id);
    if (id) await prisma.config_cities.delete({ where: { id } }).catch(() => null);
    res.json({ success: true });
  });
}
