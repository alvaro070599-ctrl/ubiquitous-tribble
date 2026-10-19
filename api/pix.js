'use strict';
const crypto = require('crypto');
const { readConfig } = require('./_lib/env');
const { buildPix } = require('./_lib/pix');

// Limite simples por IP (em memória; vale por instância da função)
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
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch (e) { b = null; }
  }
  return b && typeof b === 'object' ? b : null;
}

const pad = (n) => String(n).padStart(3, '0');
const money = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  }

  const cfg = readConfig();
  if (!cfg.pixKey) {
    return res.status(503).json({ error: 'Pagamento indisponível no momento. Fale com os noivos.' });
  }

  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'Requisição inválida.' });

  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const phone = String(body.phone || '').replace(/\D/g, '');
  if (name.length < 3 || name.length > 80) {
    return res.status(400).json({ error: 'Digite seu nome completo.' });
  }
  if (phone.length < 10 || phone.length > 13) {
    return res.status(400).json({ error: 'Digite um WhatsApp válido com DDD.' });
  }

  if (!Array.isArray(body.numbers) || body.numbers.length === 0) {
    return res.status(400).json({ error: 'Escolha pelo menos um número.' });
  }
  const numbers = [...new Set(body.numbers.map(Number))].sort((a, b) => a - b);
  const valid = numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= cfg.totalNumbers);
  if (!valid) return res.status(400).json({ error: 'Números inválidos.' });
  if (numbers.length > cfg.maxPerOrder) {
    return res.status(400).json({ error: `Máximo de ${cfg.maxPerOrder} números por compra.` });
  }

  const sold = new Set(cfg.soldNumbers);
  const unavailable = numbers.filter((n) => sold.has(n));
  if (unavailable.length) {
    return res.status(409).json({ error: 'Alguns números já foram vendidos.', unavailable });
  }

  // O valor é SEMPRE calculado aqui, nunca vem do navegador.
  const total = Math.round(numbers.length * cfg.price * 100) / 100;
  const orderId = 'RIFA' + crypto.randomBytes(4).toString('hex').toUpperCase();

  const payload = buildPix({
    key: cfg.pixKey,
    name: cfg.pixName,
    city: cfg.pixCity,
    amount: total,
    txid: orderId,
  });

  let whatsappUrl = '';
  if (cfg.whatsapp) {
    const msg =
      `Olá! Acabei de fazer o Pix da rifa do casamento 💍\n\n` +
      `Pedido: ${orderId}\nNome: ${name}\nWhatsApp: ${phone}\n` +
      `Números: ${numbers.map(pad).join(', ')}\nValor: ${money(total)}\n\nSegue o comprovante:`;
    whatsappUrl = `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`;
  }

  return res.status(200).json({ payload, total, numbers, orderId, whatsappUrl });
};
