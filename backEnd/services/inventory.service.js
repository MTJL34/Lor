const { readDatabase, mutateDatabase } = require('../config/database');
const HttpError = require('../utils/HttpError');
const { toSafeInt, toSafeNonNegativeInt } = require('../utils/validation');
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
    const current = toSafeNonNegativeInt(inventory[key], 0);
    needed[key] = Math.max(0, total - current);
  }

  return needed;
}

function normalizeUserId(userId) {
  return toSafeInt(userId, NaN);
}

function getCatalogRegions(database) {
  const regions = database.catalog && Array.isArray(database.catalog.regions)
    ? database.catalog.regions
    : [];

  return [...regions].sort((left, right) => left.regionId - right.regionId);
}

function listRegions(database) {
  return getCatalogRegions(database)
    .filter((region) => region.regionName)
    .map((region) => ({
      region_id: region.regionId,
      region_name: region.regionName
    }));
}

function getRegionById(database, regionId) {
  return getCatalogRegions(database).find((region) => region.regionId === regionId) || null;
}

function getUserCollection(database) {
  return Array.isArray(database.users) ? database.users : [];
}

function getInventoryCollection(database) {
  if (!Array.isArray(database.userInventories)) {
    database.userInventories = [];
  }

  return database.userInventories;
}

function getAppStateCollection(database) {
  if (!Array.isArray(database.userAppStates)) {
    database.userAppStates = [];
  }

  return database.userAppStates;
}

function getUserById(database, userId) {
  return getUserCollection(database).find((user) => user.id === userId) || null;
}

function getNextId(rows) {
  return rows.reduce((maxId, row) => Math.max(maxId, row.id || 0), 0) + 1;
}

function getSiteRegions(database) {
  const siteData = database.catalog && database.catalog.siteData;
  return siteData && typeof siteData === 'object' && siteData.regions
    ? siteData.regions
    : {};
}

function buildDefaultInventoryByDbRegionName(database) {
  const defaults = new Map();

  for (const [siteRegionName, data] of Object.entries(getSiteRegions(database))) {
    const dbRegionName = toDbRegionName(siteRegionName);
    defaults.set(dbRegionName, sanitizeInventoryInput(data.inventory_default || {}));
  }

  return defaults;
}

function createInventoryRow(database, userId, regionId, values) {
  const rows = getInventoryCollection(database);
  const now = new Date().toISOString();

  const row = {
    id: getNextId(rows),
    userId,
    regionId,
    ...sanitizeInventoryInput(values),
    createdAt: now,
    updatedAt: now
  };

  rows.push(row);
  return row;
}

function toInventoryResponseRow(row) {
  return {
    region_id: row.regionId,
    nova_crystal: row.nova_crystal,
    nova_shards: row.nova_shards,
    star_crystal: row.star_crystal,
    gemstone: row.gemstone,
    wild_shards: row.wild_shards,
    updated_at: row.updatedAt
  };
}

function ensureUserInventoryRowsInDatabase(database, userId) {
  const user = getUserById(database, userId);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const inventoryRows = getInventoryCollection(database);
  const defaultsByRegionName = buildDefaultInventoryByDbRegionName(database);

  for (const region of listRegions(database)) {
    const exists = inventoryRows.some(
      (row) => row.userId === userId && row.regionId === region.region_id
    );

    if (exists) {
      continue;
    }

    createInventoryRow(
      database,
      userId,
      region.region_id,
      defaultsByRegionName.get(region.region_name) || getEmptyInventory()
    );
  }
}

async function ensureUserInventoryRows(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const database = await readDatabase();

  if (!getUserById(database, normalizedUserId)) {
    throw new HttpError(404, 'User not found');
  }

  const regions = listRegions(database);
  const inventoryRows = getInventoryCollection(database);
  const missing = regions.some(
    (region) => !inventoryRows.some(
      (row) => row.userId === normalizedUserId && row.regionId === region.region_id
    )
  );

  if (!missing) {
    return;
  }

  await mutateDatabase((nextDatabase) => {
    ensureUserInventoryRowsInDatabase(nextDatabase, normalizedUserId);
  });
}

function getUserInventoryRowsFromDatabase(database, userId) {
  ensureUserInventoryRowsInDatabase(database, userId);

  const regionsById = new Map(getCatalogRegions(database).map((region) => [region.regionId, region]));

  return getInventoryCollection(database)
    .filter((row) => row.userId === userId)
    .sort((left, right) => left.regionId - right.regionId)
    .map((row) => ({
      ...toInventoryResponseRow(row),
      region_name: (regionsById.get(row.regionId) || {}).regionName || ''
    }));
}

async function getUserInventory(userId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureUserInventoryRows(normalizedUserId);

  const database = await readDatabase();
  const rows = getUserInventoryRowsFromDatabase(database, normalizedUserId);
  const siteRegions = getSiteRegions(database);

  const regions = rows.map((row) => {
    const siteRegionName = toSiteDataRegionName(row.region_name);
    const siteRegion = siteRegions[siteRegionName] || {};
    const inventory = sanitizeInventoryInput(row);
    const totals = sanitizeInventoryInput(siteRegion.totals || {});

    return {
      regionId: row.region_id,
      regionName: row.region_name,
      displayRegionName: siteRegionName,
      inventory,
      totals,
      needed: computeNeeded(totals, inventory),
      updatedAt: row.updated_at
    };
  });

  const globalNeeded = regions.reduce((accumulator, region) => {
    for (const key of RESOURCE_KEYS) {
      accumulator[key] = (accumulator[key] || 0) + (region.needed[key] || 0);
    }
    return accumulator;
  }, getEmptyInventory());

  return {
    resources: RESOURCE_KEYS,
    regions,
    globalNeeded
  };
}

function upsertUserRegionInventoryInDatabase(database, userId, regionId, payload) {
  const values = sanitizeInventoryInput(payload);
  const region = getRegionById(database, regionId);

  if (!region) {
    throw new HttpError(404, 'Region not found');
  }

  ensureUserInventoryRowsInDatabase(database, userId);

  const inventoryRows = getInventoryCollection(database);
  const existing = inventoryRows.find(
    (row) => row.userId === userId && row.regionId === regionId
  );

  if (!existing) {
    return createInventoryRow(database, userId, regionId, values);
  }

  Object.assign(existing, values, {
    updatedAt: new Date().toISOString()
  });

  return existing;
}

async function upsertUserRegionInventory(userId, regionId, payload) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedRegionId = toSafeInt(regionId, NaN);

  const row = await mutateDatabase((database) =>
    upsertUserRegionInventoryInDatabase(database, normalizedUserId, normalizedRegionId, payload)
  );

  return toInventoryResponseRow(row);
}

async function craftNovaCrystal(userId, regionId, amount) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedRegionId = toSafeInt(regionId, NaN);
  const craftAmount = toSafeNonNegativeInt(amount, 0);

  if (craftAmount <= 0) {
    throw new HttpError(400, 'Craft amount must be > 0');
  }

  return mutateDatabase((database) => {
    ensureUserInventoryRowsInDatabase(database, normalizedUserId);

    const row = getInventoryCollection(database).find(
      (entry) => entry.userId === normalizedUserId && entry.regionId === normalizedRegionId
    );

    if (!row) {
      throw new HttpError(404, 'Inventory row not found for region');
    }

    const availableShards = toSafeNonNegativeInt(row.nova_shards, 0);
    const maxCraftable = Math.floor(availableShards / 100);

    if (craftAmount > maxCraftable) {
      throw new HttpError(400, `Not enough nova_shards. Max craftable: ${maxCraftable}`);
    }

    row.nova_shards -= craftAmount * 100;
    row.nova_crystal += craftAmount;
    row.updatedAt = new Date().toISOString();

    return {
      crafted: craftAmount,
      inventory: {
        id: row.id,
        ...toInventoryResponseRow(row)
      }
    };
  });
}

function normalizeImportedAppState(appState, regionIdByName) {
  const inventoryByRegion = appState && appState.inventoryByRegion ? appState.inventoryByRegion : {};
  const prepared = [];

  for (const [regionName, inventory] of Object.entries(inventoryByRegion)) {
    const dbRegionName = toDbRegionName(regionName);
    const regionId = regionIdByName.get(dbRegionName);

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
  const normalizedUserId = normalizeUserId(userId);

  return mutateDatabase((database) => {
    ensureUserInventoryRowsInDatabase(database, normalizedUserId);

    const regionIdByName = new Map(
      listRegions(database).map((region) => [region.region_name, region.region_id])
    );
    const rows = normalizeImportedAppState(appState, regionIdByName);

    for (const entry of rows) {
      upsertUserRegionInventoryInDatabase(
        database,
        normalizedUserId,
        entry.regionId,
        entry.inventory
      );
    }

    const states = getAppStateCollection(database);
    const existing = states.find((row) => row.userId === normalizedUserId);
    const now = new Date().toISOString();

    if (existing) {
      existing.appState = appState || {};
      existing.updatedAt = now;
    } else {
      states.push({
        userId: normalizedUserId,
        appState: appState || {},
        createdAt: now,
        updatedAt: now
      });
    }

    return {
      importedRegions: rows.length
    };
  });
}

async function exportAppState(userId) {
  const normalizedUserId = normalizeUserId(userId);
  await ensureUserInventoryRows(normalizedUserId);

  const database = await readDatabase();
  const inventoryRows = getUserInventoryRowsFromDatabase(database, normalizedUserId);

  const inventoryByRegion = {};
  for (const row of inventoryRows) {
    inventoryByRegion[toSiteDataRegionName(row.region_name)] = sanitizeInventoryInput(row);
  }

  const persisted = getAppStateCollection(database).find((row) => row.userId === normalizedUserId);
  const baseState = persisted && persisted.appState && typeof persisted.appState === 'object'
    ? persisted.appState
    : {};

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
