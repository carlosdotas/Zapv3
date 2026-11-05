import { buildApp } from './app.js';

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);
const configuredHost = process.env.BIND_HOST?.trim() || process.env.HOST?.trim();
const bindHost = configuredHost && ['0.0.0.0', '127.0.0.1', '::', '::1', 'localhost'].includes(configuredHost)
  ? configuredHost
  : '0.0.0.0';

app.listen({ port, host: bindHost }).catch(error => { app.log.error(error); process.exit(1); });
