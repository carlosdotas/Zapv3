import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { api } from './api';
import { orderService } from './orderService';
import { cleanOrderId, getOrderKey } from '../utils/orderIds';
import { pedidoIdFromPlace } from './presenceService';
import { cleanPedidoId } from '../../backend/mappers';
import { assignmentOperation, assignmentOrderNumber, sameAssignmentOperation } from '../../backend/assignmentKeys';

let previousWindow: PropertyDescriptor | undefined;
let previousStorage: PropertyDescriptor | undefined;
let storage: Map<string, string>;

beforeEach(() => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  storage = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  });
});

afterEach(() => {
  for (const [key, descriptor] of [['window', previousWindow], ['localStorage', previousStorage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const response = (body: unknown) => new Response(JSON.stringify(body));

test('serviço e fachada bloqueiam salvamento e exclusão por motorista sem requisição HTTP', async t => {
  storage.set('encomendaszap_user_role', 'motorista');
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => assert.fail('Motorista não pode salvar ou excluir pedidos.'));
  t.mock.method(console, 'warn', () => {});
  for (const client of [orderService, api]) {
    assert.deepEqual(await client.savePedido({ id: 'pedido-501-coleta' }), {
      success: false, message: 'Motoristas não possuem permissão para adicionar ou editar pedidos.'
    });
    assert.deepEqual(await client.deletePedido('pedido-501-coleta'), {
      success: false, message: 'Motoristas não possuem permissão para excluir pedidos.'
    });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('salvamento preserva payload, sessão, erros e confirmação do ID pelo servidor', async t => {
  storage.set('encomendaszap_user_role', 'atendente');
  storage.set('encomendaszap_auth_token', 'sessao');
  let result: unknown = { success: true, data: { id: 701 } };
  const bodies: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    assert.equal(url, '/pedidos/save');
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer sessao');
    bodies.push(JSON.parse(String(init.body)));
    return response(result);
  });
  for (const client of [orderService, api]) {
    result = { success: true, data: { id: 701 } };
    assert.deepEqual(await client.savePedido({ id: 'pedido-501-coleta', cliente: 'Cliente' }), { success: true, id: 701, data: { id: 701 } });
    assert.deepEqual(bodies.at(-1), { id: '501', cliente: 'Cliente', token: 'sessao' });
    assert.deepEqual(await client.savePedido({ cliente: 'Cliente' }), { success: true, id: 701, data: { id: 701 } });
    assert.deepEqual(bodies.at(-1), { cliente: 'Cliente', token: 'sessao' });
    result = { success: true, id: '702' };
    assert.deepEqual(await client.savePedido({}), { success: true, id: '702', data: { id: '702' } });
    result = { success: true };
    assert.match((await client.savePedido({})).message!, /não confirmou o ID/);
    result = { success: false, message: 'Não foi possível salvar.' };
    assert.deepEqual(await client.savePedido({}), result);
  }
});

test('variantes de identificadores preservam as diferenças de transporte, interface, backend e atribuição', async t => {
  const cases = [
    { input: '501', transport: '501', ui: '501', backend: '501', assignment: '501', operation: '' },
    { input: 'pedido-501-coleta', transport: '501', ui: '501', backend: '501', assignment: '501', operation: 'coleta' },
    { input: 'pedido-501-entrega', transport: '501', ui: '501', backend: '501', assignment: '501', operation: 'entrega' },
    { input: 'pedido-501-troca', transport: '501', ui: '501', backend: '501', assignment: '501', operation: 'troca' },
    { input: 'pedido-501-retorno', transport: '501', ui: '501', backend: '501', assignment: '501', operation: 'retorno' },
    { input: ' pedido-501-coleta ', transport: 'pedido-501-coleta', ui: '501', backend: '501', assignment: '', operation: '' },
    { input: 'pedido-501-coleta ', transport: '501-coleta', ui: '501', backend: '501', assignment: '', operation: '' },
    { input: 'pedido-501-COLETA', transport: '501-COLETA', ui: '501', backend: '501-COLETA', assignment: '501', operation: 'coleta' },
    { input: 'PEDIDO-501-coleta', transport: 'PEDIDO-501', ui: 'PEDIDO-501', backend: 'PEDIDO-501', assignment: '501', operation: 'coleta' },
    { input: '501_coleta', transport: '501_coleta', ui: '501_coleta', backend: '501_coleta', assignment: '501', operation: 'coleta' },
    { input: 'EZ-501-GO', transport: 'EZ-501-GO', ui: 'EZ-501-GO', backend: 'EZ-501-GO', assignment: '', operation: '' },
    { input: 'draft-501', transport: 'draft-501', ui: 'draft-501', backend: 'draft-501', assignment: '', operation: '' }
  ];
  let lastId: unknown;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    lastId = JSON.parse(String(init.body)).id;
    return response({ success: true });
  });
  for (const row of cases) {
    await orderService.getPedido(row.input);
    assert.equal(lastId, row.transport, row.input);
    assert.equal(cleanOrderId(row.input), row.ui, row.input);
    assert.equal(cleanPedidoId(row.input), row.backend, row.input);
    assert.equal(assignmentOrderNumber(row.input), row.assignment, row.input);
    assert.equal(assignmentOperation(row.input), row.operation, row.input);
    assert.equal(pedidoIdFromPlace({ id: row.input }), '501', row.input);
  }
  for (const id of [0, 501]) {
    await orderService.getPedido(id);
    assert.equal(lastId, String(id));
  }
  assert.equal(pedidoIdFromPlace({ id: 'local-sem-id', orderCode: 'EZ-701-GO' }), '701');
  assert.equal(getOrderKey({ id: 'pedido-501-coleta' }), 'pedido-501');
  assert.equal(getOrderKey({ id: 'pedido-501-entrega' }), 'pedido-501');
  assert.equal(sameAssignmentOperation('pedido-501-coleta', '501_coleta'), true);
  assert.equal(sameAssignmentOperation('pedido-501-coleta', 'pedido-501-entrega'), false);
});

test('operações da fachada preservam a normalização histórica em duas passagens', async t => {
  const ids: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    ids.push(JSON.parse(String(init.body)).pedido_id);
    return response({ success: true });
  });
  const cases = [
    { input: 'pedido-501-coleta', direct: '501', facade: '501' },
    { input: ' pedido-501-coleta ', direct: 'pedido-501-coleta', facade: '501' },
    { input: 'pedido-pedido-501-coleta-coleta', direct: 'pedido-501-coleta', facade: '501' },
    { input: 'pedido-501-COLETA', direct: '501-COLETA', facade: '501-COLETA' }
  ];
  for (const row of cases) {
    for (const client of [orderService, api]) {
      ids.length = 0;
      await client.marcarColetaEntrega(row.input, 'coletado', 7, 'Motorista', { distanceM: 1200, lat: -16.7, lng: -49.2 });
      await client.reverterBaixa(row.input, 'coleta');
      await client.setEtapa(row.input, 7);
      await client.finalizarPedido(row.input, 7);
      assert.deepEqual(ids, Array(4).fill(client === api ? row.facade : row.direct), row.input);
    }
  }
});
