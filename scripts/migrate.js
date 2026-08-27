const fs = require('fs');
const path = require('path');
const { getPool } = require('../lib/db');
(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await getPool().query(sql);
  await getPool().end();
  console.log('Obsi Support schema applied.');
})().catch((error) => { console.error(error); process.exit(1); });
