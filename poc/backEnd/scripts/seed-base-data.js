const { DATABASE_FILE, seedDatabase } = require('../config/database');

async function main() {
  await seedDatabase({ preserveRuntimeData: true });

  console.log('[db:seed] JSON database synced from front-end data');
  console.log('[db:seed] File:', DATABASE_FILE);
  console.log('[db:seed] Runtime collections preserved: users, inventories, app state, audit log');
}

main().catch((error) => {
  console.error('[db:seed] Failed', error);
  process.exit(1);
});
