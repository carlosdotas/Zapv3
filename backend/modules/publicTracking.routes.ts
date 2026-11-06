import type { Express } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../db';
import { pedidoToBackend } from '../mappers';


export function registerPublicTrackingRoutes(app: Express) {
app.get('/api/public/tracking/:token', async (req: Request, res: Response) => {
    const token = String(req.params.token || '').toLowerCase();
    res.setHeader('Cache-Control', 'no-store');
    if (!/^[a-f0-9]{48}$/.test(token)) {
      res.status(404).json({ success: false, message: 'Rastreio não encontrado.' });
      return;
    }
    try {
      const order = await prisma.orders.findUnique({ where: { public_tracking_token: token } });
      if (!order) {
        res.status(404).json({ success: false, message: 'Rastreio não encontrado.' });
        return;
      }
      const view = pedidoToBackend(order);
      const events = [
        { label: 'Pedido recebido', at: view.created_at || view.data },
        { label: 'Coleta realizada', at: view.coleta_saida_at },
        { label: 'Troca realizada', at: view.troca_saida_at },
        { label: 'Entrega realizada', at: view.entrega_saida_at }
      ].filter(e => e.at).map(e => ({ label: e.label, at: String(e.at) }));
      res.json({
        success: true,
        data: {
          code: String(view.orderCode || view.codigo || order.id),
          stage: String(view.etapa).toLowerCase(),
          operation: String(view.tipo_encomenda).toLowerCase(),
          scheduledDate: String(order.date || ''),
          updatedAt: String(view.updated_at || view.created_at || ''),
          originCity: String(view.coleta_cidade || ''),
          destinationCity: String(view.entrega_cidade || ''),
          events
        }
      });
    } catch (error) {
      console.warn('[Public tracking] Falha ao consultar o pedido:', error);
      res.status(503).json({ success: false, message: 'Rastreio temporariamente indisponível.' });
    }
  });
}
