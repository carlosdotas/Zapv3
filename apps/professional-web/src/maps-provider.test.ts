import { expect, test } from 'vitest';
import { openStreetMapProvider, panMapPoint, projectMapPoint, unprojectMapPoint, validMapPoint, visibleMapTiles } from './maps-provider';

test('usa os blocos oficiais do OpenStreetMap sem chave', () => {
  expect(openStreetMapProvider.tileUrl(15, 100, 200)).toBe('https://tile.openstreetmap.org/15/100/200.png');
});

test('projeta e recupera coordenadas geográficas', () => {
  const point = { latitude: -16.6812, longitude: -49.2512 };
  const projected = projectMapPoint(point, 15);
  expect(unprojectMapPoint(projected.x, projected.y, 15).latitude).toBeCloseTo(point.latitude, 8);
  expect(unprojectMapPoint(projected.x, projected.y, 15).longitude).toBeCloseTo(point.longitude, 8);
  expect(validMapPoint({ latitude: 90, longitude: 0 })).toBe(false);
});

test('carrega somente blocos visíveis e limita blocos fora do mapa', () => {
  const tiles = visibleMapTiles({ latitude: 0, longitude: 0 }, 3, 400, 300);
  expect(tiles.length).toBeGreaterThan(0);
  expect(tiles.every(tile => tile.x >= 0 && tile.x < 8 && tile.y >= 0 && tile.y < 8)).toBe(true);
  expect(visibleMapTiles({ latitude: 0, longitude: 0 }, 3, 0, 300)).toEqual([]);
});

test('arrastar move a região do mapa na direção correspondente', () => {
  const start = { latitude: -16.68, longitude: -49.25 };
  expect(panMapPoint(start, 15, -256, 0).longitude).toBeGreaterThan(start.longitude);
  expect(panMapPoint(start, 15, 256, 0).longitude).toBeLessThan(start.longitude);
});
