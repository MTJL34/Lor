const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

const SQL_FILE = path.resolve(__dirname, '../../frontEnd/data/all_data_mysql.sql');

async function main() {
  const sql = await fs.readFile(SQL_FILE, 'utf8');

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    charset: 'utf8mb4',
    multipleStatements: true
  });

  try {
    console.log('[db:seed] Importing SQL from', SQL_FILE);
    await connection.query(sql);
    console.log('[db:seed] Done');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('[db:seed] Failed', error);
  process.exit(1);
});
