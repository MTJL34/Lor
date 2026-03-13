const { ensureCoreTables, getMissingBaseTables } = require('../services/dbBootstrap.service');

async function main() {
  await ensureCoreTables();
  const missing = await getMissingBaseTables();

  console.log('[db:init] Core backend tables ready');
  if (missing.length) {
    console.warn('[db:init] Missing base tables:', missing.join(', '));
    console.warn('[db:init] Run `npm run db:seed` to import base data');
  }
}

main().catch((error) => {
  console.error('[db:init] Failed', error);
  process.exit(1);
});
