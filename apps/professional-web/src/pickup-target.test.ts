import { expect, test } from 'vitest';
import { isPickupForProfessional } from './pickup-target';

test('somente chamadas direcionadas ao motorista são exibidas', () => {
  expect(isPickupForProfessional({ professionalId: 'motorista' }, 'motorista')).toBe(true);
  expect(isPickupForProfessional({ professionalId: 'outro-motorista' }, 'motorista')).toBe(false);
});
