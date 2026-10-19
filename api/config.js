'use strict';
const { readConfig } = require('./_lib/env');

// Só expõe dados públicos. A chave Pix e o WhatsApp NÃO saem daqui.
module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const c = readConfig();
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({
    PRICE: c.price,
    TOTAL_NUMBERS: c.totalNumbers,
    DRAW_DATE: c.drawDate,
    INSTAGRAM: c.instagram,
    SOLD_NUMBERS: c.soldNumbers,
  });
};
