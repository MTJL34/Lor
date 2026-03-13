const { query } = require('../config/database');

async function getRegions() {
  return query(
    `
    SELECT region_id AS regionId, region_name AS regionName, region_icon AS regionIcon
    FROM region
    ORDER BY region_id ASC
    `
  );
}

async function getCosts() {
  return query(
    `
    SELECT cost_id AS costId, cost_value AS costValue
    FROM cost
    ORDER BY cost_id ASC
    `
  );
}

async function getStars() {
  return query(
    `
    SELECT stars_id AS starsId, stars_value AS starsValue
    FROM stars
    ORDER BY stars_id ASC
    `
  );
}

async function getLevels() {
  return query(
    `
    SELECT level_id AS levelId, actual_level AS actualLevel, level_needed AS levelNeeded
    FROM level
    ORDER BY level_id ASC
    `
  );
}

async function getConstellations() {
  return query(
    `
    SELECT constellation_id AS constellationId, constellation_value AS constellationValue
    FROM constellation_number
    ORDER BY constellation_id ASC
    `
  );
}

module.exports = {
  getRegions,
  getCosts,
  getStars,
  getLevels,
  getConstellations
};
