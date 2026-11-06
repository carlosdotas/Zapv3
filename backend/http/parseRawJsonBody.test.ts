import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request } from 'express';
import { parseRawJsonBody } from './parseRawJsonBody';

const cases: Array<{ name: string; body: unknown; expected: unknown }> = [
  { name: 'objeto JSON em Buffer', body: Buffer.from('{"token":"sessao","ids":[1]}'), expected: { token: 'sessao', ids: [1] } },
  { name: 'array JSON em Buffer', body: Buffer.from('[1,2]'), expected: [1, 2] },
  { name: 'null JSON em Buffer', body: Buffer.from('null'), expected: null },
  { name: 'número JSON em Buffer', body: Buffer.from('42'), expected: 42 },
  { name: 'booleano JSON em Buffer', body: Buffer.from('false'), expected: false },
  { name: 'string JSON em Buffer', body: Buffer.from('"texto"'), expected: 'texto' },
  { name: 'JSON inválido', body: Buffer.from('{'), expected: {} },
  { name: 'Buffer vazio', body: Buffer.alloc(0), expected: {} },
  { name: 'corpo ausente', body: undefined, expected: {} },
  { name: 'corpo null', body: null, expected: {} },
  { name: 'string sem processamento', body: '{"id":1}', expected: {} },
  { name: 'número sem processamento', body: 42, expected: {} },
  { name: 'booleano sem processamento', body: false, expected: {} }
];

for (const { name, body, expected } of cases) {
  test(`preserva o parsing de ${name}`, () => {
    assert.deepEqual(parseRawJsonBody({ body } as Request), expected);
  });
}

test('preserva a identidade de objetos e arrays já processados', () => {
  for (const body of [{ token: 'sessao', ids: [1] }, [1, 2]]) {
    assert.equal(parseRawJsonBody({ body } as Request), body);
  }
});
