import { afterEach, describe, expect, it, vi } from 'vitest';
import { login } from './index.js';

describe('login', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retorna a sessão quando a autenticação é aceita', async () => {
    const session = { token: 'test-token', user: { id: '1', name: 'Teste', roles: ['professional'] } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(session), { status: 200 })));
    await expect(login('https://example.test', '+5562999999999', 'senha')).resolves.toEqual(session);
  });

  it('distingue credenciais recusadas, servidor indisponível e erro de conexão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 503 })).mockRejectedValueOnce(new TypeError('network')));
    await expect(login('', 'telefone', 'senha')).rejects.toThrow('LOGIN_FAILED');
    await expect(login('', 'telefone', 'senha')).rejects.toThrow('LOGIN_SERVER_ERROR');
    await expect(login('', 'telefone', 'senha')).rejects.toThrow('LOGIN_CONNECTION_ERROR');
  });

  it('trata resposta inválida como erro do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('não é JSON', { status: 200 })));
    await expect(login('', 'telefone', 'senha')).rejects.toThrow('LOGIN_SERVER_ERROR');
  });
});
