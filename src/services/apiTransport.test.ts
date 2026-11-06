import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { getApiUrl, getApiWebSocketUrl, request, setApiBaseUrl, setAuthToken } from './httpClient';
import { financialService } from './financialService';
import { uploadImage } from './imageUploadService';
import { DriverTrackingClient } from './driverTrackingClient';
import { backgroundGeolocationService } from './backgroundGeolocationService';
import type { Driver } from '../types/map';

const globalKeys = ['window', 'document', 'localStorage', 'WebSocket'] as const;
let originals: Map<string, PropertyDescriptor | undefined>;
let storage: Map<string, string>;

beforeEach(() => {
  originals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  storage = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(new EventTarget(), { location: new URL('https://app.example.com/') })
  });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: new EventTarget() });
});

afterEach(() => {
  for (const key of globalKeys) {
    const descriptor = originals.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' }
});

test('financeiro envia filtros e sessão à API configurada e preserva itens e totais', async t => {
  setApiBaseUrl('https://api.example.com/');
  setAuthToken('sessao');
  storage.set('encomendaszap_user_role', 'atendente');
  const payload = { success: true, data: [{ id: 7, total: 21.75 }], subtotal_unpaid: 21.75, subtotal_paid: 13, total_count: 1 };
  const calls: Array<{ url: string; body: unknown }> = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer sessao');
    assert.equal(new Headers(init.headers).get('X-User-Role'), 'atendente');
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return jsonResponse(payload);
  });
  const payable = { driver_id: '7', paid: false, from: '2026-11-01', to: '2026-11-06', busca: 'Coleta' };
  const receivable = { client_id: 9, client_name: 'Cliente', status: 'unpaid' as const, from: '2026-11-01', to: '2026-11-06', busca: 'EZ-7' };
  assert.deepEqual(await financialService.getPayableAccounts(payable), payload);
  assert.deepEqual(await financialService.getReceivableAccounts(receivable), payload);
  assert.deepEqual(calls, [
    { url: 'https://api.example.com/api/financial/payable/list', body: { ...payable, token: 'sessao' } },
    { url: 'https://api.example.com/api/financial/receivable/list', body: { ...receivable, token: 'sessao' } }
  ]);
});

test('baixas preservam ID único, lista de IDs, reversão e forma de pagamento', async t => {
  setAuthToken('sessao');
  const calls: Array<{ url: string; body: unknown }> = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return jsonResponse({ success: true });
  });
  assert.equal(await financialService.settlePayableAccount(7), true);
  assert.equal(await financialService.settlePayableAccount([7, 8], false), true);
  assert.equal(await financialService.settleReceivableAccount(9, true, 'pix'), true);
  assert.equal(await financialService.settleReceivableAccount([9, 10], false), true);
  assert.deepEqual(calls, [
    { url: '/api/financial/payable/settle', body: { id: 7, paid: true, token: 'sessao' } },
    { url: '/api/financial/payable/settle', body: { ids: [7, 8], paid: false, token: 'sessao' } },
    { url: '/api/financial/receivable/settle', body: { id: 9, paid: true, payment_method: 'pix', token: 'sessao' } },
    { url: '/api/financial/receivable/settle', body: { ids: [9, 10], paid: false, token: 'sessao' } }
  ]);
});

for (const status of [401, 403, 500]) {
  test(`financeiro mantém retorno de falha em HTTP ${status}`, async t => {
    t.mock.method(globalThis, 'fetch', async () => jsonResponse({ success: false, message: 'Falha do servidor' }, status));
    for (const result of [await financialService.getPayableAccounts(), await financialService.getReceivableAccounts()]) {
      assert.deepEqual(result, { success: false, data: [], subtotal_unpaid: 0, subtotal_paid: 0, total_count: 0, message: 'Falha do servidor' });
    }
    assert.equal(await financialService.settlePayableAccount(7), false);
    assert.equal(await financialService.settleReceivableAccount(9), false);
  });
}

test('financeiro trata falha de rede, JSON inválido e timeout sem repetir baixas', async t => {
  for (const error of [new Error('Sem rede'), new SyntaxError('JSON inválido'), new DOMException('Timeout', 'AbortError')]) {
    const mocked = t.mock.method(globalThis, 'fetch', async () => { throw error; });
    const result = await financialService.getPayableAccounts();
    assert.equal(result.success, false);
    assert.deepEqual(result.data, []);
    assert.equal(await financialService.settleReceivableAccount(9), false);
    assert.equal(mocked.mock.callCount(), 2);
    mocked.mock.restore();
  }
});

test('checagem HTTP estrita é opcional para os consumidores anteriores de request', async t => {
  const payload = { success: true, data: [1] };
  t.mock.method(globalThis, 'fetch', async () => jsonResponse(payload, 500));
  assert.deepEqual(await request('/legado'), payload);
  assert.deepEqual(await request('/legado', 'GET', undefined, 8000, { requireHttpOk: true }), { success: false, message: 'HTTP 500' });
});

test('financeiro cancela uma requisição após 30 segundos sem repeti-la', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const mocked = t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')));
    });
  });
  const pending = financialService.getReceivableAccounts();
  t.mock.timers.tick(30000);
  const result = await pending;
  assert.equal(result.success, false);
  assert.deepEqual(result.data, []);
  assert.equal(result.message, 'Tempo limite de conexão esgotado.');
  assert.equal(mocked.mock.callCount(), 1);
});

test('resolução mantém HTTP relativo e usa host, porta e protocolo da API no socket', () => {
  assert.equal(getApiUrl('pedidos/get'), '/pedidos/get');
  assert.equal(getApiWebSocketUrl('/ws/tracking'), 'wss://app.example.com/ws/tracking');
  setApiBaseUrl('http://localhost:3001/');
  assert.equal(getApiUrl('/pedidos/get'), 'http://localhost:3001/pedidos/get');
  assert.equal(getApiWebSocketUrl('/ws/tracking'), 'ws://localhost:3001/ws/tracking');
  setApiBaseUrl('https://api.example.com:8443/backend/');
  assert.equal(getApiUrl('/pedidos/get'), 'https://api.example.com:8443/backend/pedidos/get');
  assert.equal(getApiWebSocketUrl('/ws/tracking'), 'wss://api.example.com:8443/ws/tracking');
  setApiBaseUrl('/backend');
  assert.equal(getApiWebSocketUrl('/ws/tracking'), 'wss://app.example.com/ws/tracking');
});

test('upload usa API e sessão configuradas mantendo payload, resposta e ausência de timeout curto', async t => {
  setApiBaseUrl('https://api.example.com');
  setAuthToken('sessao');
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    assert.equal(url, 'https://api.example.com/users/upload_foto');
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer sessao');
    const image = 'data:image/jpeg;base64,dGVzdA==';
    assert.deepEqual(JSON.parse(String(init.body)), { user_id: 7, base64: image, image, foto: image, tipo: 'perfil' });
    assert.equal(init.signal, undefined);
    return jsonResponse({ success: true, data: { path: '/uploads/users/perfil.jpg' } });
  });
  assert.equal(await uploadImage('data:image/jpeg;base64,dGVzdA==', { type: 'perfil', fallbackEndpoint: '/users/upload_foto', fallbackData: { user_id: 7 } }), '/uploads/users/perfil.jpg');
});

test('tracking usa a API configurada no WebSocket e nos fallbacks HTTP, mantendo a autenticação do socket', async t => {
  setApiBaseUrl('https://api.example.com');
  setAuthToken('sessao');
  let address: string | undefined;
  const sent: string[] = [];
  let socket: { onopen?: () => void };
  class Socket {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 0;
    constructor(url: string) { address = url; socket = this; }
    onopen?: () => void;
    send(value: string) { sent.push(value); }
    close() {}
  }
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: Socket });
  const driver = { id: '7', coordinates: { lat: -16.7, lng: -49.2 }, lastSeenTimestamp: Date.now() } as Driver;
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    urls.push(String(url));
    if (init?.body) assert.deepEqual(JSON.parse(String(init.body)), driver);
    return jsonResponse({ success: true, data: [driver] });
  });
  const client = new DriverTrackingClient();
  try {
    assert.equal(address, 'wss://api.example.com/ws/tracking');
    socket!.onopen?.();
    assert.deepEqual(sent.map(value => JSON.parse(value)), [{ type: 'auth', token: 'sessao' }]);
    await client.sendLocation(driver);
    assert.deepEqual(await client.fetchLiveDrivers(), [driver]);
    assert.equal(urls[0], 'https://api.example.com/api/tracking/update-driver');
    assert.match(urls[1], /^https:\/\/api\.example\.com\/api\/tracking\/live-drivers\?_t=\d+$/);
  } finally {
    client.disconnect();
  }
});

test('ponte Android recebe HTTP e WebSocket da mesma API e preserva o token separado do motorista', () => {
  setApiBaseUrl('https://api.example.com');
  setAuthToken('sessao');
  const calls: unknown[][] = [];
  window.AndroidApp = {
    configureBackgroundTracking: () => assert.fail('A ponte deve usar a configuração com alertas quando disponível.'),
    configureBackgroundTrackingWithAlerts: (...args) => { calls.push(args); return true; }
  };
  const driver = { id: '7' } as Driver;
  try {
    backgroundGeolocationService.startBackgroundTracking(driver);
    assert.equal(backgroundGeolocationService.getStatus().isActive, true);
    assert.deepEqual(calls, [['https://api.example.com/api/tracking/update-driver', JSON.stringify(driver), 'wss://api.example.com/ws/tracking', 'sessao']]);
  } finally {
    backgroundGeolocationService.stopBackgroundTracking();
  }
});

test('eventos de um socket encerrado não substituem a conexão iniciada depois', async t => {
  setAuthToken('sessao');
  const sockets: Socket[] = [];
  class Socket {
    static OPEN = 1;
    static CONNECTING = 0;
    readyState = 1;
    onopen?: () => void;
    onclose?: () => void;
    sent: string[] = [];
    constructor() { sockets.push(this); }
    send(value: string) { this.sent.push(value); }
    close() { this.readyState = 3; }
  }
  Object.defineProperty(globalThis, 'WebSocket', { configurable: true, value: Socket });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => assert.fail('O socket atual deve continuar disponível.'));
  const client = new DriverTrackingClient();
  try {
    client.disconnect();
    client.connect();
    sockets[0].onclose?.();
    sockets[1].onopen?.();
    await client.sendLocation({ id: '7' } as Driver);
    assert.deepEqual(sockets[0].sent, []);
    assert.equal(JSON.parse(sockets[1].sent[0]).type, 'auth');
    assert.equal(JSON.parse(sockets[1].sent[1]).type, 'driver:update_location');
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally {
    client.dispose();
  }
});
