
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  max: 10,                      
  idleTimeoutMillis: 30000,    
});

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


const query = (text, params) => pool.query(text, params);

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
