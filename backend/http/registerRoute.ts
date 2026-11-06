import type { Express, Request, Response } from 'express';
import { parseRawJsonBody } from './parseRawJsonBody';
import { DatabaseUnavailableError, isPrismaConnectionError } from '../db';

type Handler = (req: Request, res: Response, body: any) => Promise<void> | void;

export function route(app: Express, paths: string | string[], handler: Handler) {
  const list = (Array.isArray(paths) ? paths : [paths]).flatMap(p => [p, `/api${p}`]);
  app.all(list, async (req: Request, res: Response) => {
    try {
      await handler(req, res, parseRawJsonBody(req));
    } catch (err: any) {
      console.error(`[API] ${req.method} ${req.path}:`, err);
      if (!res.headersSent) {
        const unavailable = err instanceof DatabaseUnavailableError || isPrismaConnectionError(err);
        res.status(unavailable ? 503 : 500).json({
          success: false,
          message: unavailable ? 'Banco de dados indisponível. Tente novamente mais tarde.' : err?.message || 'Erro interno do servidor'
        });
      }
    }
  });
}
