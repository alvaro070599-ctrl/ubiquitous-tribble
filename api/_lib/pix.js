'use strict';
// Gerador de BR Code (Pix "copia e cola") — roda só no servidor.

const strip = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim();

const tlv = (id, val) => id + String(val.length).padStart(2, '0') + val;

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildPix({ key, name, city, amount, txid }) {
  const merchant = tlv('00', 'BR.GOV.BCB.PIX') + tlv('01', String(key).trim());
  const p =
    tlv('00', '01') +
    tlv('26', merchant) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', amount.toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', (strip(name) || 'RIFA').slice(0, 25)) +
    tlv('60', (strip(city) || 'BRASIL').slice(0, 15)) +
    tlv('62', tlv('05', txid || '***')) +
    '6304';
  return p + crc16(p);
}

module.exports = { buildPix, crc16, strip, tlv };
