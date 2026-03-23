const { readDatabase, mutateDatabase } = require('../config/database');
const HttpError = require('../utils/HttpError');

async function getSiteDataPayload() {
  const database = await readDatabase();
  const payload = database.catalog && database.catalog.siteData;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(500, 'Invalid JSON database payload for site data');
  }

  return payload;
}

async function saveSiteDataPayload(payload) {
  await mutateDatabase((database) => {
    database.catalog = database.catalog || {};
    database.catalog.siteData = payload;
  });
}

module.exports = {
  getSiteDataPayload,
  saveSiteDataPayload
};
