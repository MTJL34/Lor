const { spawn } = require('child_process');
const path = require('path');

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script failed with code ${code}: ${scriptPath}`));
      }
    });
  });
}

async function main() {
  const seedScript = path.resolve(__dirname, './seed-base-data.js');
  const initScript = path.resolve(__dirname, './init-core-tables.js');

  await runNodeScript(seedScript);
  await runNodeScript(initScript);

  console.log('[db:setup] JSON database setup complete');
}

main().catch((error) => {
  console.error('[db:setup] Failed', error);
  process.exit(1);
});
