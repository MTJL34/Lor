const {
  REQUIRED_BASE_TABLES,
  ensureDatabaseFile,
  readDatabase
} = require('../config/database');

function hasRequiredValue(database, pathExpression) {
  const value = pathExpression
    .split('.')
    .reduce((current, key) => (current && current[key] !== undefined ? current[key] : undefined), database);

  if (pathExpression === 'catalog.siteData') {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  return Array.isArray(value);
}

async function ensureCoreTables() {
  await ensureDatabaseFile();
}

async function getMissingBaseTables() {
  const database = await readDatabase();
  return REQUIRED_BASE_TABLES.filter((entry) => !hasRequiredValue(database, entry));
}

module.exports = {
  ensureCoreTables,
  getMissingBaseTables,
  REQUIRED_BASE_TABLES
};
