import type { Express } from 'express';
import { prisma } from '../db';
import { resolveCaller, isPrivileged } from '../access';
import { parseExtra } from '../mappers';
import { route } from '../http/registerRoute';

export function registerSettingsRoutes(app: Express) {
route(app, '/settings', async (_req, res) => {
    const row = await prisma.app_settings.findUnique({ where: { key: 'global_config' } });
    res.json({ success: true, data: row ? parseExtra(row.value) : null });
  });

route(app, '/settings/save', async (req, res, body) => {
    const caller = await resolveCaller(req, body);
    if (!caller || !isPrivileged(caller)) {
      res.status(caller ? 403 : 401).json({ success: false, message: 'Apenas a equipe administrativa pode alterar as configurações.' });
      return;
    }
    const settings = body.settings ?? body;
    const radius = Number(settings.operation?.urgentNotificationRadiusKm);
    if (settings.operation?.urgentNotificationRadiusKm !== undefined && (!Number.isFinite(radius) || radius < 1 || radius > 50)) {
      res.status(400).json({ success: false, message: 'O raio urgente deve estar entre 1 e 50 km.' });
      return;
    }
    const value = JSON.stringify(settings);
    await prisma.app_settings.upsert({
      where: { key: 'global_config' },
      create: { key: 'global_config', value },
      update: { value }
    });
    res.json({ success: true, data: JSON.parse(value) });
  });
}
