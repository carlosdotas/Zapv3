import type { Express } from 'express';
import { prisma } from '../db';
import { route } from '../http/registerRoute';

export function registerPricingRoutes(app: Express) {
const parseJson = (raw: string | null | undefined, fallback: any) => {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

route(app, '/tabela-precos/entre-cidades', async (_req, res) => {
    const [company, cities] = await Promise.all([prisma.company.findFirst(), prisma.config_cities.findMany({ orderBy: { city: 'asc' } })]);
    res.json({
      success: true,
      data: {
        cidades: cities.map(c => ({ id: c.id, name: c.city, estado: c.state || 'GO' })),
        lista: parseJson(company?.orders_city_price_rules, [])
      }
    });
  });

route(app, '/tabela-precos/coleta', async (_req, res) => {
    const [company, hubs] = await Promise.all([prisma.company.findFirst(), prisma.locations.findMany({ where: { is_collection_hub: true } })]);
    const config = parseJson(company?.orders_pickup_delivery_prices, { coleta: '0', entrega: '0' });
    res.json({ success: true, data: hubs.map(h => ({ local_id: h.id, nome: h.name, cidade: h.city || '', config })) });
  });
}
