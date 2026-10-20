'use strict';

const { Pool } = require('pg');

let pool;
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}
module.exports = { getPool };
