import type { Express } from 'express';
import { DatabaseUnavailableError, prisma, persistentDatabase } from '../db';
import { CompanyValidationError, companyWithLocation, parseCompanyLocationId, saveCompanyWithLocation } from '../companyLocations';
import { parseExtra } from '../mappers';
import { route } from '../http/registerRoute';

export function registerCompaniesRoutes(app: Express) {
route(app, '/companies', async (_req, res) => {
    const database = await persistentDatabase();
    if (!database) throw new DatabaseUnavailableError();
    const rows = await database.transportadoras.findMany({ orderBy: { updated_at: 'desc' } });
    const companies: Array<Record<string, unknown> & { id: string }> = rows.map(r => ({ ...parseExtra(r.data), id: r.id }));
    const locationIds = companies.flatMap(company => {
      try {
        const id = parseCompanyLocationId(company.locationId);
        return id === null ? [] : [id];
      } catch {
        console.warn(`[Companies] Local inválido na transportadora ${company.id}.`);
        return [];
      }
    });
    const locations = locationIds.length
      ? await database.locations.findMany({ where: { id: { in: [...new Set(locationIds)] } } })
      : [];
    const byId = new Map(locations.map(location => [location.id, location]));
    res.json({
      success: true,
      data: companies.map(company => companyWithLocation(company, byId.get(Number(company.locationId)) || null))
    });
  });

route(app, '/companies/save', async (_req, res, body) => {
    try {
      const database = await persistentDatabase();
      if (!database) throw new DatabaseUnavailableError();
      const savedCompany = await saveCompanyWithLocation(
        body.company ?? body,
        id => database.locations.findUnique({ where: { id } }),
        (id, data) => database.transportadoras.upsert({ where: { id }, create: { id, data }, update: { data } })
      );
      res.json({ success: true, data: savedCompany });
    } catch (error) {
      if (!(error instanceof CompanyValidationError)) throw error;
      res.status(400).json({ success: false, message: error.message });
    }
  });

route(app, '/companies/delete', async (_req, res, body) => {
    const id = String(body.id || '');
    if (!id) {
      res.status(400).json({ success: false, message: 'Informe a transportadora a excluir.' });
      return;
    }
    const company = await prisma.transportadoras.findUnique({ where: { id } });
    if (!company) {
      res.status(404).json({ success: false, message: 'Transportadora não encontrada.' });
      return;
    }
    await prisma.transportadoras.delete({ where: { id } });
    res.json({ success: true });
  });
}
