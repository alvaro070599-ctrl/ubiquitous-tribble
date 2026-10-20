'use strict';
const { readConfig } = require('./_lib/env');
const { getPool } = require('./_lib/db');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const expected = String(process.env.ADMIN_PASSWORD || '');
  const supplied = String((req.body && req.body.password) || '');
  if (!expected) return res.status(503).json({ error: 'Painel não configurado. Configure ADMIN_PASSWORD na Vercel.' });
  if (supplied.length !== expected.length || !require('crypto').timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }
  try {
    const c = readConfig();
    let soldNumbers = [...c.soldNumbers];
    if (process.env.DATABASE_URL) {
      const pool = getPool();
      const result = await pool.query(`SELECT DISTINCT n.number
        FROM public.raffle_order_numbers n
        JOIN public.raffle_orders o ON o.id = n.order_id
        WHERE o.status IN ('paid', 'legacy_paid')
           OR (o.status = 'pending' AND o.expires_at > NOW())
        ORDER BY n.number`);
      soldNumbers = [...new Set([...soldNumbers, ...result.rows.map(r => Number(r.number))])];
    }
    soldNumbers.sort((a, b) => a - b);
    return res.status(200).json({ soldNumbers, totalNumbers: c.totalNumbers, availableCount: Math.max(0, c.totalNumbers - soldNumbers.length) });
  } catch (err) {
    console.error('Erro no painel da rifa:', err && err.message);
    return res.status(503).json({ error: 'Não foi possível consultar os números agora.' });
  }
};
