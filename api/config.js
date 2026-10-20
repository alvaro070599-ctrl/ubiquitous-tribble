'use strict';
const { readConfig } = require('./_lib/env');
const { getPool } = require('./_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const c = readConfig();
  try {
    let soldNumbers = [...c.soldNumbers];
    if (process.env.DATABASE_URL) {
      const pool = getPool();
      // Números ficam indisponíveis assim que o QR Pix é gerado; não há confirmação automática do pagamento.
      const result = await pool.query(`SELECT DISTINCT n.number
        FROM public.raffle_order_numbers n
        JOIN public.raffle_orders o ON o.id = n.order_id
        WHERE o.status IN ('paid', 'legacy_paid')
           OR (o.status = 'pending' AND o.expires_at > NOW())
        ORDER BY n.number`);
      soldNumbers = [...new Set([...soldNumbers, ...result.rows.map(r => Number(r.number))])].sort((a,b)=>a-b);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      PRICE: c.price, TOTAL_NUMBERS: c.totalNumbers, DRAW_DATE: c.drawDate,
      INSTAGRAM: c.instagram, SOLD_NUMBERS: soldNumbers,
    });
  } catch (err) {
    console.error('Erro ao consultar números da rifa:', err && err.message);
    return res.status(503).json({ error: 'Não foi possível consultar os números agora.' });
  }
};
