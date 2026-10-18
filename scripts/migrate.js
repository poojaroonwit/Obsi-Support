const fs = require('fs');
const path = require('path');
const { getPool } = require('../lib/db');
const MIGRATION_LOCK = 1940261019;

(async () => {
  const pool = getPool();
  const client = await pool.connect();
  let locked = false;
  try {
    // Rolling production replicas must not apply DDL concurrently.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    locked = true;
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log('Obsi Support schema applied.');
  } finally {
    if (locked) {
      try { await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]); }
      catch (error) { console.error('Migration lock cleanup failed:', error); }
    }
    client.release();
    await pool.end();
  }
})().catch((error) => { console.error(error); process.exit(1); });
