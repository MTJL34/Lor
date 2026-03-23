const app = require('./app');
const env = require('./config/env');
const { ensureCoreTables, getMissingBaseTables } = require('./services/dbBootstrap.service');

async function start() {
  await ensureCoreTables();
  const missingBaseTables = await getMissingBaseTables();

  if (missingBaseTables.length) {
    console.warn(
      '[WARN] Missing base data tables:',
      missingBaseTables.join(', '),
      '-> run `npm run db:setup` to import initial data.'
    );
  }

  app.listen(env.port, () => {
    console.log(`[API] Listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error('[FATAL] Failed to start server', error);
  process.exit(1);
});
