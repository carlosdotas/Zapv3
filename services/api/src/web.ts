import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

type FrontendName = 'home' | 'company' | 'professional' | 'admin';
type FrontendTarget = { name: FrontendName; root: string; prefix: string };

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function hostname(request: FastifyRequest): string {
  return (request.headers.host ?? '').split(':')[0].toLowerCase();
}

function pathFor(request: FastifyRequest): string {
  return new URL(request.url, 'http://localhost').pathname;
}

function rootFor(name: FrontendName): string {
  const assembledRoot = resolve(process.cwd(), process.env.FRONTEND_DIST_ROOT ?? 'services/api/dist/public');
  const assembled = resolve(assembledRoot, name);
  return assembled;
}

function targetFor(request: FastifyRequest): FrontendTarget | null {
  const host = hostname(request);
  const pathname = pathFor(request);

  if (host === 'api.dotas.site' || host.startsWith('api.')) return null;
  if (host === 'empresa.dotas.site' || host.startsWith('empresa.')) return { name: 'company', root: rootFor('company'), prefix: '/' };
  if (host === 'profissional.dotas.site' || host.startsWith('profissional.')) return { name: 'professional', root: rootFor('professional'), prefix: '/' };
  if (host === 'admin.dotas.site' || host.startsWith('admin.')) return { name: 'admin', root: rootFor('admin'), prefix: '/' };

  if (pathname === '/empresa' || pathname.startsWith('/empresa/')) return { name: 'company', root: rootFor('company'), prefix: '/empresa' };
  if (pathname === '/profissional' || pathname.startsWith('/profissional/')) return { name: 'professional', root: rootFor('professional'), prefix: '/profissional' };
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return { name: 'admin', root: rootFor('admin'), prefix: '/admin' };
  return { name: 'home', root: rootFor('home'), prefix: '/' };
}

function relativePath(target: FrontendTarget, pathname: string): string {
  if (target.prefix === '/') return pathname;
  const trimmed = pathname.slice(target.prefix.length);
  return trimmed || '/';
}

async function filePath(root: string, pathname: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const candidate = resolve(root, `.${decoded}`);
  const relativeCandidate = relative(root, candidate);
  if (relativeCandidate.startsWith('..') || relativeCandidate.includes(`..${sep}`)) return null;

  try {
    const details = await stat(candidate);
    return details.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

async function sendFrontend(target: FrontendTarget, pathname: string, reply: FastifyReply) {
  const requested = relativePath(target, pathname);
  const requestedFile = await filePath(target.root, requested);
  const hasExtension = Boolean(extname(requested));
  const candidate = requestedFile ?? (hasExtension ? null : await filePath(target.root, '/index.html'));

  if (!candidate) return reply.code(404).send({ message: `Arquivo GET:${pathname} não encontrado`, error: 'Não encontrado', statusCode: 404 });

  const contentType = contentTypes[extname(candidate).toLowerCase()] ?? 'application/octet-stream';
  if (target.name === 'home' && /^\/downloads\/(motorista|transportadora)\.json$/.test(requested)) reply.header('Cache-Control', 'no-cache');
  if (extname(candidate).toLowerCase() === '.html') {
    reply.header('Content-Security-Policy', "frame-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  }
  return reply.type(contentType).send(createReadStream(candidate));
}

export function registerFrontendRoutes(app: FastifyInstance) {
  app.get('/*', async (request, reply) => {
    const pathname = pathFor(request);
    if (pathname.startsWith('/api/')) return reply.code(404).send({ message: `Rota GET:${pathname} não encontrada`, error: 'Não encontrado', statusCode: 404 });

    const target = targetFor(request);
    if (!target) return reply.code(404).send({ message: `Rota GET:${pathname} não encontrada`, error: 'Não encontrado', statusCode: 404 });
    return sendFrontend(target, pathname, reply);
  });
}
