import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { extractPhotoUrls, formatPhotoUrl, getVariantSuffix, normalizePhotoPath } from './photoAdapters';
import { setApiBaseUrl } from '../httpClient';
import { getImageServerUrl, initializeImageServerConfig } from '../imageServerConfig';
import { getImageServerUrl as compatibilityUrl, initializeImageServerConfig as compatibilityInit } from '../api';
import { formatPhotoUrl as compatibilityPhoto } from '../apiAdapters';

let previousStorage: PropertyDescriptor | undefined;
beforeEach(() => {
  previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => items.set(key, value) }
  });
});
afterEach(() => {
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('variantes PHP mantêm o host original e fotos Node continuam usando o original', () => {
  const variants = [
    ['icon', '_icon.jpg', '&w=64&h=64&fit=crop'],
    ['thumb', '_thumb.jpg', '&w=200&h=200&fit=crop'],
    ['md', '_md.jpg', '&w=480'],
    ['lg', '_lg.jpg', '&w=1200']
  ] as const;
  for (const [size, suffix, query] of variants) {
    assert.equal(getVariantSuffix(size), suffix);
    const source = 'https://original.example.com/custom.php?file=photo.png';
    assert.equal(formatPhotoUrl(source, size), `https://original.example.com/custom.php?f=photo.png${query}`);
    assert.equal(compatibilityPhoto(source, size), formatPhotoUrl(source, size));
    assert.equal(formatPhotoUrl('/uploads/pedidos/coleta/prova.png', size), '/uploads/pedidos/coleta/prova.png');
  }
});

test('listas de fotos preservam JSON legado, ordem, deduplicação e filtros de valores inválidos', () => {
  const photo = '/uploads/pedidos/coleta/prova.png';
  const external = 'https://cdn.example.com/photo.jpg';
  assert.deepEqual(extractPhotoUrls(JSON.stringify([photo, { url: external }, photo])), [photo, external]);
  assert.deepEqual(extractPhotoUrls([photo, external, photo]), [photo, external]);
  assert.deepEqual(extractPhotoUrls('["/uploads/users/avatar.jpg",]'), ['/uploads/users/avatar.jpg']);
  for (const input of [null, undefined, '', 'null', 'undefined', '[]', '{"url":"foto"}', 'https://maps.app.goo.gl/123']) {
    assert.deepEqual(extractPhotoUrls(input), []);
    assert.equal(formatPhotoUrl(input), null);
  }
  assert.equal(formatPhotoUrl('data:image/png;base64,AA=='), 'data:image/png;base64,AA==');
});

test('caminhos locais e identificadores legados respeitam a URL configurada da API', () => {
  setApiBaseUrl('https://api.example.com/');
  assert.equal(formatPhotoUrl('/uploads/pedidos/entrega/prova.png'), 'https://api.example.com/uploads/pedidos/entrega/prova.png');
  assert.equal(formatPhotoUrl('/uploads/users/avatar.jpg'), 'https://api.example.com/uploads/users/avatar.jpg');
  assert.equal(normalizePhotoPath('legacy-123', 'thumb'), 'https://api.example.com/uploads/pedidos/mercadoria/legacy-123_thumb.jpg');
});

test('entrada antiga e módulo de fotos compartilham a mesma configuração e requisição de inicialização', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async (url: unknown) => {
    assert.equal(url, '/api/image-server-config');
    return new Response(JSON.stringify({ success: true, data: { url: ' https://images.example.com/images.php/ ' } }));
  });
  const first = compatibilityInit();
  assert.equal(initializeImageServerConfig(), first);
  await first;
  assert.equal(compatibilityInit(), first);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(getImageServerUrl(), 'https://images.example.com/images.php');
  assert.equal(compatibilityUrl(), getImageServerUrl());
  assert.equal(formatPhotoUrl('/uploads/users/avatar.jpg'), 'https://images.example.com/images.php?f=avatar.jpg&w=480');
  assert.equal(compatibilityPhoto('/uploads/users/avatar.jpg'), formatPhotoUrl('/uploads/users/avatar.jpg'));
});
