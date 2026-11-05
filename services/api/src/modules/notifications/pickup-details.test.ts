import { expect, test } from 'vitest';
import { distanceKm, validatePickupDetails } from './pickup-details.js';

test('valida dados opcionais e rejeita coordenadas ou textos inválidos', () => {
  expect(validatePickupDetails(undefined)).toEqual({ pickupName: null, pickupAddress: null, latitude: null, longitude: null });
  expect(validatePickupDetails({ pickupName: ' Loja ', pickupAddress: ' Rua 1 ', latitude: -16, longitude: -49 })).toEqual({ pickupName: 'Loja', pickupAddress: 'Rua 1', latitude: -16, longitude: -49 });
  for (const input of [{ latitude: 1 }, { latitude: 91, longitude: 0 }, { latitude: '1', longitude: 2 }, { pickupName: 'x'.repeat(161) }, { pickupAddress: 'Rua\n123' }]) expect(() => validatePickupDetails(input)).toThrow('INVALID_DETAILS');
});

test('calcula distância aproximada em linha reta', () => {
  expect(distanceKm(-16.68, -49.25, -16.68, -49.25)).toBe(0);
  expect(distanceKm(-16.68, -49.25, -16.68, -49.24)).toBeGreaterThan(1);
  expect(distanceKm(-16.68, -49.25, -16.68, -49.24)).toBeLessThan(1.2);
});
