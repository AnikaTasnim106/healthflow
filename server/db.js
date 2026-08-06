// ============================================================
//  db.js — PostgreSQL connection
//  Ei file tai puro backend er database gateway.
//  Onno kono file e direct pg import korbe na — always ekhan theke query() nibe.
// ============================================================

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  max: 10,                      // eksathe maximum 10 ta connection
  idleTimeoutMillis: 30000,     // 30s idle thakle connection chere dey
});

// Server chalu howar somoy ekbar test kore ney
pool.connect()
  .then(client => {
    client.release();
    console.log('✅ PostgreSQL connected —', process.env.DB_NAME);
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection FAILED');
    console.error('   ', err.message);
    console.error('   .env file er value gulo check koro (DB_PASSWORD, DB_NAME)');
  });

/**
 * Query chalanor helper.
 *
 * ⚠️ IMPORTANT: value gulo SHOB SOMOY $1, $2 diye pathabe.
 *    String concat kore query banabe NA — SQL injection hobe.
 *
 *    ✅ query('SELECT * FROM patient WHERE patient_id = $1', [id])
 *    ❌ query('SELECT * FROM patient WHERE patient_id = ' + id)
 */
const query = (text, params) => pool.query(text, params);

/**
 * Transaction chalanor helper.
 * Jekhane ekadhik table ekshathe change hoy (jemon: bill banano + bill_item insert),
 * sekhane eta use korbe — ekta fail korle sob rollback hoye jabe.
 *
 * Example:
 *   await withTransaction(async (client) => {
 *     const b = await client.query('INSERT INTO bill ... RETURNING bill_id', [...]);
 *     await client.query('INSERT INTO bill_item ...', [b.rows[0].bill_id, ...]);
 *   });
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, pool };
