const { query } = require('../config/database');
const HttpError = require('../utils/HttpError');
const { toSafeNonNegativeInt } = require('../utils/validation');
const { getSiteDataPayload } = require('./siteData.service');
const { toDbRegionName, toSiteDataRegionName } = require('../utils/regionAliases');

const RESOURCE_KEYS = ['nova_crystal', 'nova_shards', 'star_crystal', 'gemstone', 'wild_shards'];

function sanitizeInventoryInput(payload = {}) {
  const clean = {};
  for (const key of RESOURCE_KEYS) {
    clean[key] = toSafeNonNegativeInt(payload[key], 0);
  }
  return clean;
}

function getEmptyInventory() {
  return {
    nova_crystal: 0,
    nova_shards: 0,
    star_crystal: 0,
    gemstone: 0,
    wild_shards: 0
  };
}

function computeNeeded(totals = {}, inventory = {}) {
  const needed = {};

  for (const key of RESOURCE_KEYS) {
    const total = toSafeNonNegativeInt(totals[key], 0);
    const inv = toSafeNonNegativeInt(inventory[key], 0);
    needed[key] = Math.max(0, total - inv);
  }

  return needed;
}

async function listRegions() {
  return query(
    `
    SELECT region_id, region_name
    FROM region
    WHERE region_name IS NOT NULL AND region_name <> ''
    ORDER BY region_id ASC
    `
  );
}

async function buildDefaultInventoryByDbRegionName() {
  const siteData = await getSiteDataPayload();
  const defaults = new Map();

  const regions = siteData && siteData.regions ? siteData.regions : {};
  for (const [siteRegionName, data] of Object.entries(regions)) {
    const dbRegionName = toDbRegionName(siteRegionName);
    defaults.set(dbRegionName, sanitizeInventoryInput(data.inventory_default || {}));
  }

  return defaults;
}

async function ensureUserInventoryRows(userId) {
  const userRows = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!userRows.length) {
    throw new HttpError(404, 'User not found');
  }

  const regions = await listRegions();
  const defaultsByRegionName = await buildDefaultInventoryByDbRegionName();

  for (const region of regions) {
    const defaults = defaultsByRegionName.get(region.region_name) || getEmptyInventory();

    await query(
      `
      INSERT INTO user_region_inventory (
        user_id,
        region_id,
        nova_crystal,
        nova_shards,
        star_crystal,
        gemstone,
        wild_shards
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        userId,
        region.region_id,
        defaults.nova_crystal,
        defaults.nova_shards,
        defaults.star_crystal,
        defaults.gemstone,
        defaults.wild_shards
      ]
    );
  }
}

async function getUserInventoryRows(userId) {
  await ensureUserInventoryRows(userId);

  return query(
    `
    SELECT
      uri.region_id,
      r.region_name,
      uri.nova_crystal,
      uri.nova_shards,
      uri.star_crystal,
      uri.gemstone,
      uri.wild_shards,
      uri.updated_at
    FROM user_region_inventory uri
    LEFT JOIN region r ON r.region_id = uri.region_id
    WHERE uri.user_id = ?
    ORDER BY uri.region_id ASC
    `,
    [userId]
  );
}

async function getUserInventory(userId) {
  const rows = await getUserInventoryRows(userId);
  const siteData = await getSiteDataPayload();

  const siteRegions = siteData && siteData.regions ? siteData.regions : {};

  const regions = rows.map((row) => {
    const dbName = row.region_name;
    const siteRegionName = toSiteDataRegionName(dbName);
    const siteRegion = siteRegions[siteRegionName] || {};

    const inventory = sanitizeInventoryInput(row);
    const totals = sanitizeInventoryInput(siteRegion.totals || {});
    const needed = computeNeeded(totals, inventory);

    return {
      regionId: row.region_id,
      regionName: dbName,
      displayRegionName: siteRegionName,
      inventory,
      totals,
      needed,
      updatedAt: row.updated_at
    };
  });

  const globalNeeded = regions.reduce((acc, region) => {
    for (const key of RESOURCE_KEYS) {
      acc[key] = (acc[key] || 0) + (region.needed[key] || 0);
    }
    return acc;
  }, getEmptyInventory());

  return {
    resources: RESOURCE_KEYS,
    regions,
    globalNeeded
  };
}

async function upsertUserRegionInventory(userId, regionId, payload) {
  const values = sanitizeInventoryInput(payload);

  await query(
    `
    INSERT INTO user_region_inventory (
      user_id,
      region_id,
      nova_crystal,
      nova_shards,
      star_crystal,
      gemstone,
      wild_shards
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      nova_crystal = VALUES(nova_crystal),
      nova_shards = VALUES(nova_shards),
      star_crystal = VALUES(star_crystal),
      gemstone = VALUES(gemstone),
      wild_shards = VALUES(wild_shards),
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      userId,
      regionId,
      values.nova_crystal,
      values.nova_shards,
      values.star_crystal,
      values.gemstone,
      values.wild_shards
    ]
  );

  const rows = await query(
    `
    SELECT
      region_id,
      nova_crystal,
      nova_shards,
      star_crystal,
      gemstone,
      wild_shards,
      updated_at
    FROM user_region_inventory
    WHERE user_id = ? AND region_id = ?
    LIMIT 1
    `,
    [userId, regionId]
  );

  return rows[0] || null;
}

async function craftNovaCrystal(userId, regionId, amount) {
  const craftAmount = toSafeNonNegativeInt(amount, 0);
  if (craftAmount <= 0) {
    throw new HttpError(400, 'Craft amount must be > 0');
  }

  const rows = await query(
    `
    SELECT id, nova_shards, nova_crystal
    FROM user_region_inventory
    WHERE user_id = ? AND region_id = ?
    LIMIT 1
    `,
    [userId, regionId]
  );

  if (!rows.length) {
    throw new HttpError(404, 'Inventory row not found for region');
  }

  const row = rows[0];
  const availableShards = toSafeNonNegativeInt(row.nova_shards, 0);
  const maxCraftable = Math.floor(availableShards / 100);

  if (craftAmount > maxCraftable) {
    throw new HttpError(400, `Not enough nova_shards. Max craftable: ${maxCraftable}`);
  }

  await query(
    `
    UPDATE user_region_inventory
    SET
      nova_shards = nova_shards - ?,
      nova_crystal = nova_crystal + ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [craftAmount * 100, craftAmount, row.id]
  );

  const updated = await query(
    `
    SELECT
      region_id,
      nova_crystal,
      nova_shards,
      star_crystal,
      gemstone,
      wild_shards,
      updated_at
    FROM user_region_inventory
    WHERE id = ?
    LIMIT 1
    `,
    [row.id]
  );

  return {
    crafted: craftAmount,
    inventory: updated[0]
  };
}

function normalizeImportedAppState(appState, dbRegionMap) {
  const inventoryByRegion = (appState && appState.inventoryByRegion) || {};
  const prepared = [];

  for (const [regionName, inventory] of Object.entries(inventoryByRegion)) {
    const dbRegionName = toDbRegionName(regionName);
    const regionId = dbRegionMap.get(dbRegionName);
    if (!regionId) {
      continue;
    }

    prepared.push({
      regionId,
      inventory: sanitizeInventoryInput(inventory)
    });
  }

  return prepared;
}

async function importAppState(userId, appState) {
  await ensureUserInventoryRows(userId);

  const regions = await listRegions();
  const dbRegionMap = new Map(regions.map((row) => [row.region_name, row.region_id]));
  const rows = normalizeImportedAppState(appState, dbRegionMap);

  for (const entry of rows) {
    await upsertUserRegionInventory(userId, entry.regionId, entry.inventory);
  }

  await query(
    `
    INSERT INTO user_app_state (user_id, app_state_json)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE
      app_state_json = VALUES(app_state_json),
      updated_at = CURRENT_TIMESTAMP
    `,
    [userId, JSON.stringify(appState || {})]
  );

  return {
    importedRegions: rows.length
  };
}

async function exportAppState(userId) {
  await ensureUserInventoryRows(userId);

  const inventoryRows = await query(
    `
    SELECT uri.region_id, r.region_name,
           uri.nova_crystal, uri.nova_shards, uri.star_crystal, uri.gemstone, uri.wild_shards
    FROM user_region_inventory uri
    JOIN region r ON r.region_id = uri.region_id
    WHERE uri.user_id = ?
    ORDER BY uri.region_id ASC
    `,
    [userId]
  );

  const inventoryByRegion = {};
  for (const row of inventoryRows) {
    const siteName = toSiteDataRegionName(row.region_name);
    inventoryByRegion[siteName] = sanitizeInventoryInput(row);
  }

  const stateRows = await query(
    'SELECT app_state_json FROM user_app_state WHERE user_id = ? LIMIT 1',
    [userId]
  );

  const persisted = stateRows[0] ? stateRows[0].app_state_json : null;
  const baseState = persisted && typeof persisted === 'object' ? persisted : {};

  return {
    appState: {
      version: 1,
      options: baseState.options || { showSimulatedCraftView: false },
      customChampions: baseState.customChampions || {},
      inventoryByRegion
    }
  };
}

module.exports = {
  RESOURCE_KEYS,
  sanitizeInventoryInput,
  ensureUserInventoryRows,
  getUserInventory,
  upsertUserRegionInventory,
  craftNovaCrystal,
  importAppState,
  exportAppState
};
