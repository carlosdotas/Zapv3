import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
describe('API de identidade', () => {
  it('permite o acesso dos três portais à API', async () => {
    const app = buildApp();
    for (const origin of ['https://admin.dotas.site', 'https://empresa.dotas.site', 'https://profissional.dotas.site']) {
      const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/auth/login', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
    await app.close();
  });
  it('carrega o administrador de bootstrap com os perfis administrativos e profissional', async () => {
    const previousPhone = process.env.DEFAULT_ADMIN_PHONE;
    const previousPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    process.env.DEFAULT_ADMIN_PHONE = '+5562988887777';
    process.env.DEFAULT_ADMIN_PASSWORD = 'Bootstrap123!';
    try {
      const app = buildApp();
      const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { phone: '+5562988887777', password: 'Bootstrap123!' } });
      expect(login.statusCode).toBe(200);
      expect(login.json().user.roles).toEqual(expect.arrayContaining(['platform_admin', 'company_admin', 'professional']));
      const adminPing = await app.inject({ method: 'GET', url: '/api/v1/admin/ping', headers: { authorization: `Bearer ${login.json().token}` } });
      expect(adminPing.statusCode).toBe(200);
    } finally {
      if (previousPhone === undefined) delete process.env.DEFAULT_ADMIN_PHONE;
      else process.env.DEFAULT_ADMIN_PHONE = previousPhone;
      if (previousPassword === undefined) delete process.env.DEFAULT_ADMIN_PASSWORD;
      else process.env.DEFAULT_ADMIN_PASSWORD = previousPassword;
    }
  });

  it('cadastra profissional e permite entrar e consultar /me', async () => { const app = buildApp(); const registered = await app.inject({ method: 'POST', url: '/api/v1/auth/register-professional', payload: { name: 'Ana Entregas', phone: '+5511888888888', password: 'SenhaSegura123' } }); expect(registered.statusCode).toBe(201); const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { phone: '+5511888888888', password: 'SenhaSegura123' } }); expect(login.statusCode).toBe(200); const token = login.json().token; const me = await app.inject({ method: 'GET', url: '/api/v1/me', headers: { authorization: `Bearer ${token}` } }); expect(me.statusCode).toBe(200); expect(me.json().user.roles).toContain('professional'); });
  it('valida o cadastro e não cria outra conta para o mesmo telefone', async () => {
    const app = buildApp();
    for (const payload of [{}, { name: '  ', phone: '+5562999999999', password: 'Senha123' }, { name: 'Motorista', phone: '62999999999', password: 'Senha123' }, { name: 'Motorista', phone: '+5562999999999', password: 'curta' }]) {
      expect((await app.inject({ method: 'POST', url: '/api/v1/auth/register-professional', payload })).statusCode).toBe(400);
    }
    const valid = { name: ' Motorista ', phone: '+5562999999999', password: 'Senha123' };
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/register-professional', payload: valid })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/register-professional', payload: valid })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { phone: valid.phone, password: valid.password } })).statusCode).toBe(200);
    await app.close();
  });
  it('recusa acesso sem sessão e escalação administrativa', async () => { const app = buildApp(); expect((await app.inject({ method: 'GET', url: '/api/v1/me' })).statusCode).toBe(401); const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { phone: '+5511999999999', password: 'Profissional123!' } }); const denied = await app.inject({ method: 'GET', url: '/api/v1/admin/ping', headers: { authorization: `Bearer ${login.json().token}` } }); expect(denied.statusCode).toBe(403); });
  it('mantém sessões independentes e revoga somente a sessão encerrada', async () => {
    const app=buildApp();const credentials={phone:'+5511999999999',password:'Profissional123!'};
    const first=(await app.inject({method:'POST',url:'/api/v1/auth/login',payload:credentials})).json().token;
    const second=(await app.inject({method:'POST',url:'/api/v1/auth/login',payload:credentials})).json().token;
    expect(first).not.toBe(second);
    const headers={authorization:`Bearer ${first}`};
    expect((await app.inject({method:'GET',url:'/api/v1/me',headers})).statusCode).toBe(200);
    expect((await app.inject({method:'POST',url:'/api/v1/auth/logout',headers,payload:{portal:'professional'}})).statusCode).toBe(200);
    expect((await app.inject({method:'GET',url:'/api/v1/me',headers})).statusCode).toBe(401);
    expect((await app.inject({method:'GET',url:'/api/v1/me',headers:{authorization:`Bearer ${second}`}})).statusCode).toBe(200);
    await app.close();
  });
});
