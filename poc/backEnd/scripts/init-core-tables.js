const { DATABASE_FILE, ensureDatabaseFile } = require('../config/database');
const { getMissingBaseTables } = require('../services/dbBootstrap.service');

async function main() {
  await ensureDatabaseFile();
  const missing = await getMissingBaseTables();

  console.log('[db:init] JSON database ready');
  console.log('[db:init] File:', DATABASE_FILE);

  if (missing.length) {
    console.warn('[db:init] Missing collections:', missing.join(', '));
    console.warn('[db:init] Run `npm run db:seed` to regenerate the JSON database');
  }
}

main().catch((error) => {
  console.error('[db:init] Failed', error);
  process.exit(1);
});
