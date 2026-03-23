const { readDatabase } = require('../config/database');

function sortByNumericId(key) {
  return (left, right) => (left[key] || 0) - (right[key] || 0);
}

async function getRegions() {
  const database = await readDatabase();
  return [...(database.catalog && database.catalog.regions ? database.catalog.regions : [])]
    .sort(sortByNumericId('regionId'));
}

async function getCosts() {
  const database = await readDatabase();
  return [...(database.catalog && database.catalog.costs ? database.catalog.costs : [])]
    .sort(sortByNumericId('costId'));
}

async function getStars() {
  const database = await readDatabase();
  return [...(database.catalog && database.catalog.stars ? database.catalog.stars : [])]
    .sort(sortByNumericId('starsId'));
}

async function getLevels() {
  const database = await readDatabase();
  return [...(database.catalog && database.catalog.levels ? database.catalog.levels : [])]
    .sort(sortByNumericId('levelId'));
}

async function getConstellations() {
  const database = await readDatabase();
  return [...(database.catalog && database.catalog.constellations ? database.catalog.constellations : [])]
    .sort(sortByNumericId('constellationId'));
}

module.exports = {
  getRegions,
  getCosts,
  getStars,
  getLevels,
  getConstellations
};
