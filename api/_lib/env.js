'use strict';
// Lê e valida as variáveis de ambiente da Vercel.

// "3, 17, 25-30" -> [3, 17, 25, 26, ..., 30]
function parseNumberList(str) {
  const out = new Set();
  String(str || '')
    .split(/[,;\s]+/)
    .filter(Boolean)
    .forEach((part) => {
      const m = part.match(/^(\d+)-(\d+)$/);
      if (m) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        for (let n = Math.min(a, b); n <= Math.max(a, b) && n - a < 10000; n++) out.add(n);
      } else if (/^\d+$/.test(part)) {
        out.add(parseInt(part, 10));
      }
    });
  return [...out].sort((x, y) => x - y);
}

function readConfig(env = process.env) {
  const posInt = (v, d) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const price = Number(String(env.PRICE || '10').replace(',', '.'));
  return {
    pixKey: (env.PIX_KEY || '').trim(),
    pixName: env.PIX_NAME || 'RIFA',
    pixCity: env.PIX_CITY || 'BRASIL',
    whatsapp: String(env.WHATSAPP || '').replace(/\D/g, ''),
    price: Number.isFinite(price) && price > 0 ? price : 10,
    totalNumbers: posInt(env.TOTAL_NUMBERS, 500),
    maxPerOrder: posInt(env.MAX_PER_ORDER, 50),
    drawDate: env.DRAW_DATE || '',
    instagram: env.INSTAGRAM || '',
    soldNumbers: parseNumberList(env.SOLD_NUMBERS),
  };
}

module.exports = { readConfig, parseNumberList };
