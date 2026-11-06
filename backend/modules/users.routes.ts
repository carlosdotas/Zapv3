import type { Express } from 'express';
import type { Response } from 'express';
import { prisma, persistentDatabase } from '../db';
import { userToBackend, userFromBackend, toInt } from '../mappers';
import { route } from '../http/registerRoute';
import type { RouteDeps } from '../http/routeTypes';
import { digitsOf, phoneVariants, findUserFromBody, orderCounts, hashPassword } from './support/userSupport';

export function registerUsersRoutes(app: Express, deps: RouteDeps) {
route(app, '/users/reload', async (_req, res) => {
    res.json({ success: true, message: 'Usuários carregados do banco.', count: await prisma.users.count() });
  });

route(app, '/users/list', async (_req, res, body) => {
    const where: any = {};
    if (body.access_level && typeof body.access_level === 'string') where.access_level = body.access_level.toLowerCase().trim();
    const [rows, counts] = await Promise.all([prisma.users.findMany({ where, orderBy: { id: 'asc' } }), orderCounts()]);

    let list = rows;
    if (body.search && typeof body.search === 'string') {
      const q = body.search.toLowerCase().trim();
      const digits = q.replace(/\D/g, '');
      list = rows.filter(u => {
        const text = [u.name, u.full_name, u.city].map(v => (v || '').toLowerCase());
        if (text.some(t => t.includes(q))) return true;
        return !!digits && (digitsOf(u.phone).includes(digits) || digitsOf(u.cpf).includes(digits));
      });
    }
    list.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.id - b.id);

    const page = Math.max(1, parseInt(body.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(body.limit, 10) || 50), 500);
    const slice = list.slice((page - 1) * limit, page * limit);
    res.json({
      success: true,
      data: slice.map(u => userToBackend(u, counts.get(u.id) || 0)),
      total: list.length,
      page,
      limit,
      hasMore: page * limit < list.length
    });
  });

route(app, '/users/get', async (req, res, body) => {
    const id = toInt(body.id ?? req.query.id);
    const user = id ? await prisma.users.findUnique({ where: { id } }) : null;
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuário não encontrado' });
      return;
    }
    const counts = await prisma.orders.count({ where: { client_id: user.id } });
    res.json({ success: true, data: userToBackend(user, counts) });
  });

const storeProfilePhoto = async (dataUrl: string): Promise<string | null> => {
    if (deps.imageServerConfigured()) {
      const remote = await deps.uploadToPhpServer(dataUrl, 'perfil');
      if (remote) return remote;
    }
    return deps.saveBase64Image(dataUrl, 'users');
  };

const resolvePhoto = async (body: any, res: Response): Promise<boolean> => {
    const image = [body.foto, body.avatarUrl].find(v => typeof v === 'string' && v.startsWith('data:image/'));
    if (image) {
      const url = await storeProfilePhoto(image);
      if (!url) {
        res.status(502).json({ success: false, message: 'Não foi possível salvar a foto.' });
        return false;
      }
      body.foto = url;
      body.avatarUrl = url;
    } else if (body.foto) {
      body.avatarUrl = body.foto;
    } else if (body.avatarUrl) {
      body.foto = body.avatarUrl;
    }
    return true;
  };

route(app, '/users/save', async (_req, res, body) => {
    if (!(await resolvePhoto(body, res))) return;
    const existing = await findUserFromBody(body);
    const data = userFromBackend(body, existing);
    if (typeof body.password === 'string' && body.password.trim()) data.password = hashPassword(body.password);

    let saved;
    if (existing) {
      saved = await prisma.users.update({ where: { id: existing.id }, data });
    } else {
      saved = await prisma.users.create({
        data: {
          ...data,
          name: data.name || 'Usuário Sem Nome',
          full_name: data.full_name || data.name || 'Usuário Sem Nome',
          phone: data.phone || null,
          access_level: data.access_level || 'cliente'
        }
      });
    }
    const user = userToBackend(saved, await prisma.orders.count({ where: { client_id: saved.id } }));
    res.json({ success: true, id: saved.id, foto: user.foto, avatarUrl: user.avatarUrl, data: user, message: 'Usuário salvo com sucesso!' });
  });

route(app, '/users/delete', async (req, res, body) => {
    const id = toInt(body.id ?? req.query.id);
    if (!id) {
      res.status(400).json({ success: false, message: 'ID do usuário obrigatório' });
      return;
    }
    await prisma.users.delete({ where: { id } }).catch(() => null);
    res.json({ success: true });
  });

route(app, '/users/upload_foto', async (_req, res, body) => {
    const base64Data = body.base64 || body.image || body.foto || body.avatarUrl;
    let photoPath = '';
    if (typeof base64Data === 'string' && base64Data.startsWith('data:image/')) {
      const url = await storeProfilePhoto(base64Data);
      if (!url) {
        res.status(502).json({ success: false, message: 'Não foi possível salvar a foto.' });
        return;
      }
      photoPath = url;
    } else if (typeof base64Data === 'string' && !base64Data.startsWith('data:')) {
      photoPath = base64Data;
    }
    if (!photoPath) {
      res.status(400).json({ success: false, message: 'Nenhuma foto foi enviada.' });
      return;
    }
    const user = await findUserFromBody(body);
    if (user) await prisma.users.update({ where: { id: user.id }, data: { photo: photoPath } });
    res.json({ success: true, data: { path: photoPath, foto: photoPath, avatarUrl: photoPath }, path: photoPath, foto: photoPath, avatarUrl: photoPath });
  });

route(app, '/users/register', async (_req, res, body) => {
    const phone = digitsOf(body.phone);
    if (!phone) {
      res.status(400).json({ success: false, message: 'Telefone obrigatório.' });
      return;
    }
    const database = await persistentDatabase();
    if (!database) {
      res.status(503).json({ success: false, message: 'Banco de dados indisponível. Tente cadastrar novamente mais tarde.' });
      return;
    }
    const existing = await database.users.findMany({ where: { phone: { in: phoneVariants(phone) } } });
    if (existing.length) {
      res.status(409).json({ success: false, message: 'Já existe um usuário com este telefone.' });
      return;
    }
    const extra: any = { cliente_especial: 0, paga_semanal: 0, pendencias: 0 };
    if (String(body.access_level || '').toLowerCase() === 'motorista') {
      for (const key of ['tipo_veiculo', 'modelo_veiculo', 'placa']) {
        if (typeof body[key] === 'string') extra[key] = body[key].trim();
      }
      extra.status = 'ativo';
    }
    const created = await database.users.create({
      data: {
        name: String(body.name || '').trim() || 'Usuário',
        phone,
        password: typeof body.password === 'string' && body.password ? hashPassword(body.password) : null,
        access_level: ['motorista', 'atendente'].includes(String(body.access_level || '').toLowerCase())
          ? String(body.access_level).toLowerCase()
          : 'cliente',
        city: body.cidade || body.city || null,
        cpf: body.cpf ? String(body.cpf).trim() : null,
        full_name: body.name_completo || body.full_name || String(body.name || '').trim() || 'Usuário',
        extra: JSON.stringify(extra)
      }
    });
    res.json({ success: true, data: { id: created.id }, message: 'Usuário registrado com sucesso!' });
  });
}
