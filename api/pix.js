'use strict';
const crypto = require('crypto');
const { readConfig } = require('./_lib/env');
const { buildPix } = require('./_lib/pix');
const { getPool } = require('./_lib/db');

const hits = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 20;
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_HITS;
}
function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  return b && typeof b === 'object' ? b : null;
}
const pad = (n) => String(n).padStart(3, '0');
const money = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });

  const cfg = readConfig();
  if (!cfg.pixKey) return res.status(503).json({ error: 'Pagamento indisponível no momento. Fale com os noivos.' });
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'Banco de dados não configurado. Fale com os noivos.' });

  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'Requisição inválida.' });
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const phone = String(body.phone || '').replace(/\D/g, '');
  if (name.length < 3 || name.length > 80) return res.status(400).json({ error: 'Digite seu nome completo.' });
  if (phone.length < 10 || phone.length > 13) return res.status(400).json({ error: 'Digite um WhatsApp válido com DDD.' });
  if (!Array.isArray(body.numbers) || body.numbers.length === 0) return res.status(400).json({ error: 'Escolha pelo menos um número.' });

  const numbers = body.numbers.map(Number);
  if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > cfg.totalNumbers))
    return res.status(400).json({ error: 'Números inválidos.' });
  if (new Set(numbers).size !== numbers.length) return res.status(400).json({ error: 'Há números repetidos na seleção.' });
  numbers.sort((a, b) => a - b);
  if (numbers.length > cfg.maxPerOrder) return res.status(400).json({ error: `Máximo de ${cfg.maxPerOrder} números por compra.` });

  const total = Math.round(numbers.length * cfg.price * 100) / 100;
  const orderId = 'RIFA' + crypto.randomBytes(5).toString('hex').toUpperCase();
  const expiresAt = new Date('9999-12-31T23:59:59.999Z');
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // A restrição UNIQUE(number) garante que duas compras simultâneas não peguem o mesmo número.
    const conflict = await client.query(
      `SELECT n.number FROM public.raffle_order_numbers n
       JOIN public.raffle_orders o ON o.id = n.order_id
       WHERE n.number = ANY($1::integer[])
       LIMIT 1 FOR UPDATE OF n`,
      [numbers]
    );
    const envSold = new Set(cfg.soldNumbers);
    const alreadySold = numbers.filter(n => envSold.has(n));
    if (conflict.rows.length || alreadySold.length) {
      await client.query('ROLLBACK');
      const unavailable = [...new Set([...conflict.rows.map(r => Number(r.number)), ...alreadySold])];
      return res.status(409).json({ error: 'Alguns números já foram reservados ou vendidos.', unavailable });
    }

    const order = await client.query(
      `INSERT INTO public.raffle_orders
       (order_code, customer_name, customer_phone, amount, status, pix_txid, expires_at)
       VALUES ($1, $2, $3, $4, 'pending', $1, $5)
       RETURNING id`,
      [orderId, name, phone, total, expiresAt]
    );
    for (const number of numbers) {
      await client.query(
        'INSERT INTO public.raffle_order_numbers (order_id, number) VALUES ($1, $2)',
        [order.rows[0].id, number]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'Um dos números acabou de ser reservado. Atualize a página e escolha outros.', unavailable: numbers });
    }
    console.error('Erro ao criar pedido da rifa:', err && err.message);
    return res.status(500).json({ error: 'Não foi possível reservar os números. Tente novamente.' });
  } finally {
    client.release();
  }

  const payload = buildPix({ key: cfg.pixKey, name: cfg.pixName, city: cfg.pixCity, amount: total, txid: orderId });
  let whatsappUrl = '';
  if (cfg.whatsapp) {
    const msg = `Olá! Fiz o Pix da rifa do casamento 💍\n\nPedido: ${orderId}\nNome: ${name}\nWhatsApp: ${phone}\nNúmeros: ${numbers.map(pad).join(', ')}\nValor: ${money(total)}\n\nSegue o comprovante:`;
    whatsappUrl = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`;
  }
  return res.status(200).json({ payload, total, numbers, orderId, expiresAt: expiresAt.toISOString(), whatsappUrl });
};
