import { buildApp } from './app.js';
import { MysqlStore } from './mysql-store.js';

const app = buildApp(process.env.NODE_ENV === 'production' || process.env.DB_HOST || process.env.DATABASE_URL ? new MysqlStore() : undefined);
const port = Number(process.env.PORT ?? 3000);
const configuredHost = process.env.BIND_HOST?.trim() || process.env.HOST?.trim();
const bindHost = configuredHost && ['0.0.0.0', '127.0.0.1', '::', '::1', 'localhost'].includes(configuredHost)
  ? configuredHost
  : '0.0.0.0';

app.listen({ port, host: bindHost }).catch(() => { console.error('Não foi possível iniciar o serviço. Verifique a conexão e a configuração do banco de dados.'); process.exit(1); });
