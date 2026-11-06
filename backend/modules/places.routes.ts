import type { Express } from 'express';
import { prisma } from '../db';
import { localToBackend, localFromBackend, toInt } from '../mappers';
import { route } from '../http/registerRoute';

export function registerPlacesRoutes(app: Express) {
route(app, '/locais', async (req, res, body) => {
    const q = { ...body, ...req.query } as any;
    const search = String(q.search || '').trim();
    const cidade = String(q.cidade || '').trim();
    const setor = String(q.setor || '').trim();
    const and: any[] = [];
    if (search) {
      and.push({
        OR: ['name', 'address', 'street', 'district', 'city'].map(f => ({ [f]: { contains: search } }))
      });
    }
    if (cidade) and.push({ city: { contains: cidade } });
    if (setor) and.push({ district: { contains: setor } });
    if (q.central_coletas !== undefined && q.central_coletas !== '') {
      and.push({ is_collection_hub: ['true', '1', 1, true].includes(q.central_coletas) });
    }
    const where = and.length ? { AND: and } : {};
    const page = Math.max(1, parseInt(String(q.page), 10) || 1);
    const limit = Math.max(1, parseInt(String(q.limit), 10) || 100);
    const [rows, total] = await Promise.all([
      prisma.locations.findMany({ where, orderBy: { id: 'asc' }, skip: (page - 1) * limit, take: limit }),
      prisma.locations.count({ where })
    ]);
    res.json({ success: true, data: rows.map(localToBackend), total });
  });

route(app, '/locais/centrais', async (_req, res) => {
    const rows = await prisma.locations.findMany({ where: { is_collection_hub: true } });
    res.json({
      success: true,
      data: rows.map(p => ({ id: p.id, name: p.name, cidade: p.city || 'Goiânia', lat: Number(p.lat), lng: Number(p.lng) }))
    });
  });

route(app, '/locais/nearby', async (_req, res, body) => {
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);
    const radiusKm = parseFloat(body.radius_km) || 0.5;
    if (isNaN(lat) || isNaN(lng)) {
      res.json({ success: true, data: null });
      return;
    }
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
    const candidates = await prisma.locations.findMany({
      where: { lat: { gte: lat - dLat, lte: lat + dLat }, lng: { gte: lng - dLng, lte: lng + dLng } }
    });
    let closest: { local: any; dist: number } | null = null;
    for (const p of candidates) {
      const rLat = (p.lat! - lat) * Math.PI / 180;
      const rLng = (p.lng! - lng) * Math.PI / 180;
      const a = Math.sin(rLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(p.lat! * Math.PI / 180) * Math.sin(rLng / 2) ** 2;
      const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist <= radiusKm && (!closest || dist < closest.dist)) closest = { local: p, dist };
    }
    res.json({
      success: true,
      data: closest
        ? { id: closest.local.id, name: closest.local.name, lat: closest.local.lat, lng: closest.local.lng, dist_km: Math.round(closest.dist * 100) / 100, dist_m: Math.round(closest.dist * 1000) }
        : null
    });
  });

route(app, '/locais/buscar_local_link', async (req, res, body) => {
    const link = String(body.link || req.query.link || '').trim();
    const local = link ? await prisma.locations.findFirst({ where: { link_maps: link } }) : null;
    if (!local) {
      res.status(404).json({ success: false, message: 'Local não encontrado para este link' });
      return;
    }
    res.json({ success: true, data: localToBackend(local) });
  });

route(app, '/locais/update', async (_req, res, body) => {
    const id = toInt(body.id);
    const existing = id ? await prisma.locations.findUnique({ where: { id } }) : null;
    if (!existing) {
      res.status(404).json({ success: false, message: 'Local não encontrado' });
      return;
    }
    const updated = await prisma.locations.update({ where: { id: existing.id }, data: localFromBackend(body, existing) });
    res.json({ success: true, data: localToBackend(updated) });
  });

route(app, '/locais/save', async (_req, res, body) => {
    const id = toInt(body.id);
    const existing = id ? await prisma.locations.findUnique({ where: { id } }) : null;
    const data = localFromBackend(body, existing);
    const saved = existing
      ? await prisma.locations.update({ where: { id: existing.id }, data })
      : await prisma.locations.create({
          data: {
            ...data,
            name: data.name || 'Local Sem Nome',
            lat: data.lat ?? -16.6869,
            lng: data.lng ?? -49.2648,
            city: data.city ?? 'Goiânia'
          }
        });
    res.json({ success: true, id: saved.id, data: localToBackend(saved) });
  });

route(app, '/locais/delete', async (req, res, body) => {
    const id = toInt(body.id ?? req.query.id);
    if (!id) {
      res.status(400).json({ success: false, message: 'ID do local obrigatório' });
      return;
    }
    await prisma.locations.delete({ where: { id } }).catch(() => null);
    res.json({ success: true });
  });

route(app, '/locais/:id', async (req, res) => {
    const id = toInt(req.params.id);
    const local = id ? await prisma.locations.findUnique({ where: { id } }) : null;
    if (!local) {
      res.status(404).json({ success: false, message: 'Local não encontrado' });
      return;
    }
    res.json({ success: true, data: localToBackend(local) });
  });
}
