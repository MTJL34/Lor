const asyncHandler = require('../utils/asyncHandler');
const { healthCheck } = require('../config/database');
const { getMissingBaseTables } = require('../services/dbBootstrap.service');

const getHealth = asyncHandler(async (req, res) => {
  const databaseUp = await healthCheck();
  const missingTables = await getMissingBaseTables();

  res.json({
    status: databaseUp ? 'ok' : 'degraded',
    database: databaseUp ? 'up' : 'down',
    missingBaseTables: missingTables,
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  getHealth
};
