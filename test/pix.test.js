'use strict';
const assert = require('assert');
const { crc16, buildPix } = require('../api/_lib/pix');
const { parseNumberList, readConfig } = require('../api/_lib/env');

// Vetor de teste padrão do CRC16-CCITT-FALSE
assert.strictEqual(crc16('123456789'), '29B1');

// Lista de vendidos
assert.deepStrictEqual(parseNumberList('3, 17,25-27'), [3, 17, 25, 26, 27]);

// Payload: CRC válido no final, valor e campos corretos
const p = buildPix({ key: 'teste@exemplo.com', name: 'Nicolly e João', city: 'Sapucaia do Sul', amount: 30, txid: 'RIFAABC123' });
assert.ok(p.startsWith('000201'));
assert.ok(p.includes('540530.00'));
assert.ok(p.includes('NICOLLY E JOAO'));
assert.strictEqual(p.slice(-4), crc16(p.slice(0, -4)));

// Handlers
const pix = require('../api/pix');
const config = require('../api/config');
function call(handler, { method = 'POST', body, ip = '1.1.1.1', env = {} } = {}) {
  Object.assign(process.env, { PIX_KEY: 'teste@exemplo.com', PIX_NAME: 'NICOLLY E JOAO', PIX_CITY: 'SAPUCAIA DO SUL',
    WHATSAPP: '5551999999999', PRICE: '10', TOTAL_NUMBERS: '500', SOLD_NUMBERS: '5,10-12' }, env);
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; },
      json(o) { resolve({ code: this.code, body: o }); } };
    handler({ method, body, headers: { 'x-forwarded-for': ip } }, res);
  });
}
(async () => {
  let r = await call(pix, { body: { numbers: [1, 2, 3], name: 'Maria Silva', phone: '51999998888' } });
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.total, 30);
  assert.ok(r.body.payload.includes('540530.00'));
  assert.ok(r.body.whatsappUrl.startsWith('https://wa.me/5551999999999?text='));

  r = await call(pix, { body: { numbers: [4, 5, 10], name: 'Maria Silva', phone: '51999998888' } });
  assert.strictEqual(r.code, 409);
  assert.deepStrictEqual(r.body.unavailable, [5, 10]);

  r = await call(pix, { body: { numbers: [501], name: 'Maria Silva', phone: '51999998888' } });
  assert.strictEqual(r.code, 400);

  r = await call(pix, { body: { numbers: [1], name: 'Maria Silva', phone: '51999998888' }, env: { PIX_KEY: '' } });
  assert.strictEqual(r.code, 503);

  r = await call(pix, { method: 'GET' });
  assert.strictEqual(r.code, 405);

  r = await call(config, { method: 'GET' });
  assert.strictEqual(r.code, 200);
  assert.ok(!JSON.stringify(r.body).includes('teste@exemplo.com'));
  assert.deepStrictEqual(r.body.SOLD_NUMBERS, [5, 10, 11, 12]);

  console.log('Todos os testes passaram ✅');
})().catch((e) => { console.error(e); process.exit(1); });
