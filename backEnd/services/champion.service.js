const { readDatabase, mutateDatabase } = require('../config/database');
const HttpError = require('../utils/HttpError');
const { toSafeInt } = require('../utils/validation');

function sanitizeRelicsInput(relics) {
  const next = [null, null, null];

  if (!Array.isArray(relics)) {
    return next;
  }

  for (let index = 0; index < 3; index += 1) {
    const value = relics[index];
    next[index] = value === 0 || value === '0' || value === '' ? null : value || null;
  }

  return next;
}

function normalizeChampionInput(payload, partial = false) {
  const championNameRaw = payload.championName;
  const championName =
    championNameRaw === undefined || championNameRaw === null
      ? ''
      : String(championNameRaw).trim();

  const base = {
    championName,
    costId: toSafeInt(payload.costId, 0),
    poc: Boolean(payload.poc),
    championIcon: payload.championIcon || '',
    starsId: toSafeInt(payload.starsId, 0),
    lorExclusive: Boolean(payload.lorExclusive),
    constellationNumberId: toSafeInt(payload.constellationNumberId, 1),
    levelId: toSafeInt(payload.levelId, 1),
    regionId: toSafeInt(payload.regionId, 13)
  };

  if (!partial && !base.championName) {
    throw new HttpError(400, 'Field `championName` is required');
  }

  if (partial) {
    const cleaned = {};

    for (const [key, value] of Object.entries(base)) {
      if (payload[key] !== undefined) {
        cleaned[key] = value;
      }
    }

    if (Object.prototype.hasOwnProperty.call(cleaned, 'championName') && !cleaned.championName) {
      throw new HttpError(400, 'Field `championName` cannot be empty');
    }

    if (payload.relics !== undefined) {
      cleaned.relics = sanitizeRelicsInput(payload.relics);
    }

    return cleaned;
  }

  return {
    ...base,
    relics: sanitizeRelicsInput(payload.relics)
  };
}

function getCatalogLookups(database) {
  const catalog = database.catalog || {};

  return {
    costs: new Map((catalog.costs || []).map((entry) => [entry.costId, entry.costValue])),
    stars: new Map((catalog.stars || []).map((entry) => [entry.starsId, entry.starsValue])),
    constellations: new Map(
      (catalog.constellations || []).map((entry) => [entry.constellationId, entry.constellationValue])
    ),
    levels: new Map((catalog.levels || []).map((entry) => [entry.levelId, entry])),
    regions: new Map((catalog.regions || []).map((entry) => [entry.regionId, entry]))
  };
}

function mapChampionRecord(record, lookups) {
  const level = lookups.levels.get(record.levelId) || {};
  const region = lookups.regions.get(record.regionId) || {};

  return {
    championId: record.championId,
    championName: record.championName,
    costId: record.costId,
    cost: lookups.costs.has(record.costId) ? lookups.costs.get(record.costId) : '',
    poc: Boolean(record.poc),
    championIcon: record.championIcon || '',
    starsId: record.starsId,
    stars: lookups.stars.has(record.starsId) ? lookups.stars.get(record.starsId) : '',
    lorExclusive: Boolean(record.lorExclusive),
    constellationNumberId: record.constellationNumberId,
    constellationNumber: lookups.constellations.has(record.constellationNumberId)
      ? lookups.constellations.get(record.constellationNumberId)
      : '',
    levelId: record.levelId,
    level: level.actualLevel !== undefined ? level.actualLevel : '',
    levelNeeded: level.levelNeeded !== undefined ? level.levelNeeded : '',
    regionId: record.regionId,
    regionName: region.regionName || '',
    relics: sanitizeRelicsInput(record.relics)
  };
}

function getChampionCollection(database) {
  if (!database.catalog) {
    database.catalog = {};
  }

  if (!Array.isArray(database.catalog.champions)) {
    database.catalog.champions = [];
  }

  return database.catalog.champions;
}

function getNextChampionId(champions) {
  return champions.reduce((maxId, champion) => Math.max(maxId, champion.championId || 0), 0) + 1;
}

async function listChampions(filters = {}) {
  const database = await readDatabase();
  const champions = getChampionCollection(database);
  const lookups = getCatalogLookups(database);
  const search = String(filters.search || '').trim().toLowerCase();

  return champions
    .filter((champion) => {
      if (typeof filters.poc === 'boolean' && Boolean(champion.poc) !== filters.poc) {
        return false;
      }

      if (Number.isFinite(filters.regionId) && champion.regionId !== filters.regionId) {
        return false;
      }

      if (search && !String(champion.championName || '').toLowerCase().includes(search)) {
        return false;
      }

      return true;
    })
    .sort((left, right) => left.championId - right.championId)
    .map((champion) => mapChampionRecord(champion, lookups));
}

async function getChampionById(championId) {
  const database = await readDatabase();
  const champions = getChampionCollection(database);
  const champion = champions.find((entry) => entry.championId === championId);

  if (!champion) {
    return null;
  }

  return mapChampionRecord(champion, getCatalogLookups(database));
}

async function createChampion(payload) {
  const cleaned = normalizeChampionInput(payload, false);

  return mutateDatabase((database) => {
    const champions = getChampionCollection(database);
    const nextChampionId = getNextChampionId(champions);

    champions.push({
      championId: nextChampionId,
      championName: cleaned.championName,
      costId: cleaned.costId,
      poc: cleaned.poc,
      championIcon: cleaned.championIcon,
      starsId: cleaned.starsId,
      lorExclusive: cleaned.lorExclusive,
      constellationNumberId: cleaned.constellationNumberId,
      levelId: cleaned.levelId,
      regionId: cleaned.regionId,
      relics: cleaned.relics
    });

    return nextChampionId;
  });
}

async function updateChampion(championId, payload) {
  const cleaned = normalizeChampionInput(payload, true);

  await mutateDatabase((database) => {
    const champions = getChampionCollection(database);
    const champion = champions.find((entry) => entry.championId === championId);

    if (!champion) {
      throw new HttpError(404, 'Champion not found');
    }

    for (const [key, value] of Object.entries(cleaned)) {
      champion[key] = key === 'relics' ? sanitizeRelicsInput(value) : value;
    }
  });
}

async function deleteChampion(championId) {
  await mutateDatabase((database) => {
    const champions = getChampionCollection(database);
    const index = champions.findIndex((entry) => entry.championId === championId);

    if (index === -1) {
      throw new HttpError(404, 'Champion not found');
    }

    champions.splice(index, 1);
  });
}

async function updateChampionRelics(championId, relics) {
  const cleanedRelics = sanitizeRelicsInput(relics);

  await mutateDatabase((database) => {
    const champions = getChampionCollection(database);
    const champion = champions.find((entry) => entry.championId === championId);

    if (!champion) {
      throw new HttpError(404, 'Champion not found');
    }

    champion.relics = cleanedRelics;
  });

  return cleanedRelics;
}

module.exports = {
  listChampions,
  getChampionById,
  createChampion,
  updateChampion,
  deleteChampion,
  updateChampionRelics
};
