import type { Express } from 'express';
import { prisma } from '../db';
import { parseExtra, iso } from '../mappers';
import { route } from '../http/registerRoute';
import { digitsOf, findUserFromBody } from './support/userSupport';

export function registerDriversRoutes(app: Express) {
const DRIVER_LEVELS = ['motorista', 'driver', 'motoboy'];

const driverView = (user: any, driver: any) => {
    const extra = parseExtra(user.extra);
    return {
      id: user.id,
      nome: user.full_name || user.name,
      telefone: user.phone,
      cpf: user.cpf || driver?.cpf || undefined,
      cnh: driver?.cnh || extra.cnh || undefined,
      email: driver?.email || extra.email || undefined,
      endereco: driver?.address || extra.address || extra.endereco || undefined,
      cidade: user.city || driver?.city || undefined,
      estado: driver?.state || undefined,
      tipo_veiculo: extra.tipo_veiculo || (driver?.vehicle_type === 'pick_up' ? 'utilitario' : driver?.vehicle_type) || 'moto',
      placa: driver?.vehicle_plate || extra.placa || undefined,
      modelo_veiculo: driver?.vehicle_model || extra.modelo_veiculo || undefined,
      status: extra.status || (driver && !driver.is_active ? 'inativo' : 'ativo'),
      foto: user.photo || undefined,
      avatarUrl: user.photo || undefined,
      created_at: iso(user.created_at),
      updated_at: iso(user.updated_at)
    };
  };

route(app, '/motoristas/list', async (_req, res, body) => {
    const users = await prisma.users.findMany({ where: { access_level: { in: DRIVER_LEVELS } } });
    const cpfs = users.map(u => u.cpf).filter(Boolean) as string[];
    const drivers = cpfs.length ? await prisma.drivers.findMany({ where: { cpf: { in: cpfs } } }) : [];
    const byCpf = new Map(drivers.map(d => [d.cpf, d]));
    let list = users.map(u => driverView(u, u.cpf ? byCpf.get(u.cpf) : null));
    if (body.status) list = list.filter(m => m.status === body.status);
    if (body.tipo_veiculo) list = list.filter(m => m.tipo_veiculo === body.tipo_veiculo);
    if (body.busca) {
      const q = String(body.busca).toLowerCase();
      list = list.filter(m => [m.nome, m.telefone, m.cpf, m.placa].some(v => String(v || '').toLowerCase().includes(q)));
    }
    res.json({ success: true, data: list });
  });

route(app, '/motoristas/save', async (_req, res, body) => {
    const phone = digitsOf(body.telefone ?? body.phone);
    const existing = await findUserFromBody({ id: body.id, phone });
    const extra = parseExtra(existing?.extra);
    for (const key of ['tipo_veiculo', 'status', 'placa', 'modelo_veiculo', 'cnh', 'email']) {
      if (body[key] !== undefined) extra[key] = body[key];
    }
    const base = {
      name: String(body.nome || body.name || existing?.name || 'Motorista'),
      cpf: body.cpf ? String(body.cpf) : existing?.cpf ?? null,
      city: body.cidade ?? existing?.city ?? null,
      photo: body.foto ?? body.avatarUrl ?? existing?.photo ?? null,
      access_level: 'motorista',
      extra: JSON.stringify(extra)
    };
    const user = existing
      ? await prisma.users.update({ where: { id: existing.id }, data: base })
      : await prisma.users.create({ data: { ...base, phone: phone || `sem-${Date.now()}` } });

    if (body.cpf && body.cnh) {
      const common = {
        name: base.name,
        phone: user.phone || phone || '',
        city: body.cidade || null,
        address: body.endereco || null,
        vehicle_type: body.tipo_veiculo === 'utilitario' ? 'pick_up' : body.tipo_veiculo || null,
        vehicle_plate: body.placa || null,
        vehicle_model: body.modelo_veiculo || null,
        is_active: body.status ? body.status === 'ativo' : true
      };
      await prisma.drivers.upsert({
        where: { cpf: String(body.cpf) },
        create: { ...common, cpf: String(body.cpf), cnh: String(body.cnh) },
        update: { ...common, cnh: String(body.cnh) }
      });
    }
    res.json({ success: true, data: { id: user.id }, id: user.id });
  });
}
