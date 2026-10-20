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
    let soldNumbers = [...new Set([...c.soldNumbers, 47])];
    let orders = [];
    if (process.env.DATABASE_URL) {
      const pool = getPool();
      const result = await pool.query(`SELECT DISTINCT n.number
        FROM public.raffle_order_numbers n
        JOIN public.raffle_orders o ON o.id = n.order_id
        WHERE o.status IN ('paid', 'legacy_paid')
           OR o.status = 'pending'
        ORDER BY n.number`);
      soldNumbers = [...new Set([...soldNumbers, ...result.rows.map(r => Number(r.number))])];
      const orderResult = await pool.query(`SELECT o.order_code, o.customer_name, o.customer_phone,
          o.amount, o.status, o.created_at, o.expires_at,
          ARRAY_AGG(n.number ORDER BY n.number) AS numbers
        FROM public.raffle_orders o
        JOIN public.raffle_order_numbers n ON n.order_id = o.id
        WHERE o.status IN ('paid', 'legacy_paid')
           OR o.status = 'pending'
        GROUP BY o.id
        ORDER BY o.created_at DESC`);
      orders = orderResult.rows.map(o => ({
        orderCode: o.order_code,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        amount: Number(o.amount),
        status: o.status === 'pending' ? 'sold_on_qr' : o.status,
        createdAt: o.created_at,
        expiresAt: o.expires_at,
        numbers: o.numbers.map(Number)
      }));
    }
    // Compra antiga informada manualmente: número 047 da Ingrid.
    if (!orders.some(o => Array.isArray(o.numbers) && o.numbers.includes(47))) {
      orders.push({ orderCode: 'LEGACY-047', customerName: 'Ingrid', customerPhone: '', amount: 0, status: 'legacy_paid', createdAt: null, expiresAt: null, numbers: [47] });
    }
    soldNumbers = [...new Set([...soldNumbers, 47])];
    soldNumbers.sort((a, b) => a - b);
    return res.status(200).json({ soldNumbers, totalNumbers: c.totalNumbers, availableCount: Math.max(0, c.totalNumbers - soldNumbers.length), orders });
  } catch (err) {
    console.error('Erro no painel da rifa:', err && err.message);
    return res.status(503).json({ error: 'Não foi possível consultar os números agora.' });
  }
};
