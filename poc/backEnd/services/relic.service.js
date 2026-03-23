const { readDatabase } = require('../config/database');

function sortRelics(left, right) {
  return String(left.relicRarity || '').localeCompare(String(right.relicRarity || ''))
    || String(left.relicName || '').localeCompare(String(right.relicName || ''));
}

async function getRelics({ rarity = null } = {}) {
  const database = await readDatabase();
  const relics = database.catalog && Array.isArray(database.catalog.relics)
    ? database.catalog.relics
    : [];

  return relics
    .filter((relic) => !rarity || relic.relicRarity === rarity)
    .sort(sortRelics);
}

module.exports = {
  getRelics
};
