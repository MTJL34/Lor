const fs = require('fs/promises');
const path = require('path');
const { query } = require('../config/database');
const HttpError = require('../utils/HttpError');

const SITE_DATA_FILE = path.resolve(__dirname, '../../frontEnd/data/site_data.json');

async function getSiteDataFromDatabase() {
  const rows = await query(
    'SELECT id, payload FROM site_data_json WHERE id = 1 LIMIT 1'
  );

  if (!rows.length) {
    return null;
  }

  const payload = rows[0].payload;

  if (typeof payload === 'string') {
    return JSON.parse(payload);
  }

  if (payload && typeof payload === 'object') {
    return payload;
  }

  throw new HttpError(500, 'Invalid site_data_json payload format');
}

async function getSiteDataFromFile() {
  const raw = await fs.readFile(SITE_DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function getSiteDataPayload() {
  try {
    const dbPayload = await getSiteDataFromDatabase();
    if (dbPayload) {
      return dbPayload;
    }
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      throw error;
    }
  }

  return getSiteDataFromFile();
}

async function saveSiteDataPayload(payload) {
  const json = JSON.stringify(payload);
  await query(
    `
    INSERT INTO site_data_json (id, payload)
    VALUES (1, ?)
    ON DUPLICATE KEY UPDATE payload = VALUES(payload)
    `,
    [json]
  );
}

module.exports = {
  getSiteDataPayload,
  saveSiteDataPayload
};
