const { Pool } = require('pg');
let pool;
const getPool = () => {
  if (!pool) {
    const connectionString = String(process.env.DATABASE_URL || '').trim();
    if (!connectionString) throw new Error('DATABASE_URL is not configured');
    pool = new Pool({ connectionString, ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }, max: Number(process.env.PG_POOL_MAX || 10) });
  }
  return pool;
};
const query = (text, params) => getPool().query(text, params);
const withTransaction = async (fn) => {
  const client = await getPool().connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
module.exports = { getPool, query, withTransaction };
