import { register } from 'tsx/esm/api';

// Entrada JavaScript para hospedagens que não aceitam TypeScript diretamente.
process.env.NODE_ENV ||= 'production';
if (!process.argv.includes('--prod')) process.argv.push('--prod');
if (!process.argv.includes('--port') && process.env.PORT) {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT deve ser um inteiro entre 1 e 65535.');
  }
  process.argv.push('--port', String(port));
}

register();
await import('./backend/index.ts');
