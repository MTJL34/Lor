const fs = require('fs/promises');
const path = require('path');
const vm = require('vm');
const env = require('./env');

const FRONTEND_DATA_DIR = path.resolve(__dirname, '../../frontEnd/data');
const DEFAULT_DATABASE_FILE = path.resolve(__dirname, '../data/database.json');

function resolveDatabaseFile() {
  const configuredPath = String(env.storage && env.storage.jsonDbPath ? env.storage.jsonDbPath : '').trim();

  if (!configuredPath) {
    return DEFAULT_DATABASE_FILE;
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

const CONFIGURED_DATABASE_FILE = resolveDatabaseFile();
let activeDatabaseFile = CONFIGURED_DATABASE_FILE;
let fallbackWarningShown = false;

const REQUIRED_BASE_TABLES = [
  'catalog.regions',
  'catalog.costs',
  'catalog.stars',
  'catalog.levels',
  'catalog.constellations',
  'catalog.relics',
  'catalog.champions',
  'catalog.siteData',
  'users',
  'userInventories',
  'userAppStates',
  'userAuditLog'
];

let writeQueue = Promise.resolve();

function getDatabaseFile() {
  return activeDatabaseFile;
}

function canFallbackToDefault(error) {
  return activeDatabaseFile !== DEFAULT_DATABASE_FILE
    && error
    && ['EPERM', 'EACCES', 'EROFS'].includes(error.code);
}

function switchToDefaultDatabaseFile(error) {
  if (!canFallbackToDefault(error)) {
    return false;
  }

  activeDatabaseFile = DEFAULT_DATABASE_FILE;

  if (!fallbackWarningShown) {
    fallbackWarningShown = true;
    console.warn(
      `[json-db] Cannot use configured JSON_DB_PATH (${CONFIGURED_DATABASE_FILE}). ` +
      `Falling back to ${DEFAULT_DATABASE_FILE}.`,
      error.message
    );
  }

  return true;
}

function stripBom(raw) {
  return String(raw || '').replace(/^\uFEFF/, '');
}

async function fileExists(filePath = getDatabaseFile()) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (switchToDefaultDatabaseFile(error)) {
      return fileExists();
    }

    return false;
  }
}

async function readDatabaseFile() {
  try {
    const raw = await fs.readFile(getDatabaseFile(), 'utf8');
    return JSON.parse(stripBom(raw));
  } catch (error) {
    if (switchToDefaultDatabaseFile(error)) {
      return readDatabaseFile();
    }

    throw error;
  }
}

function extractExportExpression(source, exportName) {
  const marker = `export const ${exportName} =`;
  const start = source.indexOf(marker);

  if (start === -1) {
    throw new Error(`Missing export \`${exportName}\``);
  }

  let index = start + marker.length;
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }

  const expressionStart = index;
  let depth = 0;
  let quote = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === '*' && nextChar === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    if (char === '/' && nextChar === '/') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '[' || char === '{' || char === '(') {
      depth += 1;
      continue;
    }

    if (char === ']' || char === '}' || char === ')') {
      depth -= 1;
      continue;
    }

    if (char === ';' && depth === 0) {
      return source.slice(expressionStart, index).trim();
    }
  }

  if (depth === 0 && !quote && !lineComment && !blockComment) {
    return source.slice(expressionStart).trim();
  }

  throw new Error(`Unterminated export \`${exportName}\``);
}

async function loadFrontendExport(fileName, exportName) {
  const filePath = path.join(FRONTEND_DATA_DIR, fileName);
  const source = stripBom(await fs.readFile(filePath, 'utf8'));
  const expression = extractExportExpression(source, exportName);

  return vm.runInNewContext(
    `(${expression})`,
    {},
    { filename: filePath }
  );
}

async function loadSiteData() {
  const siteDataFile = path.join(FRONTEND_DATA_DIR, 'site_data.json');
  const raw = await fs.readFile(siteDataFile, 'utf8');
  return JSON.parse(stripBom(raw));
}

function sanitizeRelicCode(value) {
  return value === 0 || value === '0' || value === '' ? null : value || null;
}

function mapRegion(region) {
  return {
    regionId: Number(region.Region_ID) || 0,
    regionName: region.Region_Name || '',
    regionIcon: region.Region_Icon || ''
  };
}

function mapCost(cost) {
  return {
    costId: Number(cost.Cost_ID) || 0,
    costValue: cost.Cost_Value
  };
}

function mapStar(star) {
  return {
    starsId: Number(star.Stars_ID) || 0,
    starsValue: star.Stars_Value
  };
}

function mapLevel(level) {
  return {
    levelId: Number(level.Level_ID) || 0,
    actualLevel: level.Actual_Level,
    levelNeeded: level.Level_Needed
  };
}

function mapConstellation(constellation) {
  return {
    constellationId: Number(constellation.Constellation_ID) || 0,
    constellationValue: constellation.Constellation_Value
  };
}

function mapRelic(relic) {
  return {
    relicId: relic.Relic_ID,
    relicName: relic.Relic_Name || '',
    relicRarity: relic.Relic_Rarity || '',
    relicDescription: relic.Relic_Description || '',
    relicIcon: relic.Relic_Icon || ''
  };
}

function mapChampion(champion) {
  return {
    championId: Number(champion.Champion_ID) || 0,
    championName: champion.Champion_Name || '',
    costId: Number(champion.Cost_ID) || 0,
    poc: Boolean(champion.POC),
    championIcon: champion.Champion_Icon || '',
    starsId: Number(champion.Stars_ID) || 0,
    lorExclusive: Boolean(champion.LOR_Exclusive),
    constellationNumberId: Number(champion.Constellation_Number_ID) || 1,
    levelId: Number(champion.Level_ID) || 1,
    regionId: Number(champion.Region_ID) || 13,
    relics: Array.isArray(champion.AllRelics)
      ? champion.AllRelics.map(sanitizeRelicCode).slice(0, 3)
      : [null, null, null]
  };
}

async function buildSeedDatabase() {
  const now = new Date().toISOString();

  const [
    regions,
    costs,
    stars,
    levels,
    constellations,
    champions,
    relicsCommon,
    relicsRare,
    relicsEpic,
    siteData
  ] = await Promise.all([
    loadFrontendExport('Region.js', 'Region'),
    loadFrontendExport('Cost.js', 'Cost'),
    loadFrontendExport('Stars.js', 'Stars'),
    loadFrontendExport('Level.js', 'Level'),
    loadFrontendExport('Constellation_Number.js', 'Constellation_Number'),
    loadFrontendExport('Champion.js', 'Champion'),
    loadFrontendExport('Relics_Common.js', 'RelicsCommon'),
    loadFrontendExport('Relics_Rare.js', 'RelicsRare'),
    loadFrontendExport('Relics_Epic.js', 'RelicsEpic'),
    loadSiteData()
  ]);

  return {
    meta: {
      version: 1,
      driver: 'json',
      seededAt: now,
      updatedAt: now
    },
    catalog: {
      regions: regions.map(mapRegion),
      costs: costs.map(mapCost),
      stars: stars.map(mapStar),
      levels: levels.map(mapLevel),
      constellations: constellations.map(mapConstellation),
      relics: [...relicsCommon, ...relicsRare, ...relicsEpic].map(mapRelic),
      champions: champions.map(mapChampion),
      siteData
    },
    users: [],
    userInventories: [],
    userAppStates: [],
    userAuditLog: []
  };
}

function mergeRuntimeCollections(nextDatabase, existingDatabase) {
  return {
    ...nextDatabase,
    users: Array.isArray(existingDatabase && existingDatabase.users)
      ? existingDatabase.users
      : [],
    userInventories: Array.isArray(existingDatabase && existingDatabase.userInventories)
      ? existingDatabase.userInventories
      : [],
    userAppStates: Array.isArray(existingDatabase && existingDatabase.userAppStates)
      ? existingDatabase.userAppStates
      : [],
    userAuditLog: Array.isArray(existingDatabase && existingDatabase.userAuditLog)
      ? existingDatabase.userAuditLog
      : []
  };
}

async function writeDatabase(database) {
  const now = new Date().toISOString();
  const nextDatabase = {
    ...database,
    meta: {
      ...(database.meta || {}),
      driver: 'json',
      version: database.meta && Number.isFinite(database.meta.version)
        ? database.meta.version
        : 1,
      updatedAt: now,
      seededAt: database.meta && database.meta.seededAt
        ? database.meta.seededAt
        : now
    }
  };

  const databaseFile = getDatabaseFile();

  try {
    await fs.mkdir(path.dirname(databaseFile), { recursive: true });

    const tempFile = `${databaseFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(nextDatabase, null, 2)}\n`, 'utf8');
    await fs.rename(tempFile, databaseFile);

    return nextDatabase;
  } catch (error) {
    if (switchToDefaultDatabaseFile(error)) {
      return writeDatabase(database);
    }

    throw error;
  }
}

async function seedDatabase({ preserveRuntimeData = true } = {}) {
  const freshDatabase = await buildSeedDatabase();

  if (preserveRuntimeData && await fileExists()) {
    const existingDatabase = await readDatabaseFile();
    return writeDatabase(mergeRuntimeCollections(freshDatabase, existingDatabase));
  }

  return writeDatabase(freshDatabase);
}

async function ensureDatabaseFile() {
  if (await fileExists()) {
    return readDatabaseFile();
  }

  return seedDatabase({ preserveRuntimeData: false });
}

async function readDatabase() {
  await ensureDatabaseFile();
  return readDatabaseFile();
}

function withWriteLock(task) {
  const operation = writeQueue.then(task);
  writeQueue = operation.catch(() => {});
  return operation;
}

async function mutateDatabase(mutator) {
  return withWriteLock(async () => {
    const database = await readDatabase();
    const result = await mutator(database);
    await writeDatabase(database);
    return result;
  });
}

async function healthCheck() {
  try {
    const database = await ensureDatabaseFile();
    return Boolean(database && database.catalog);
  } catch (error) {
    return false;
  }
}

module.exports = {
  DATABASE_FILE: CONFIGURED_DATABASE_FILE,
  getDatabaseFile,
  REQUIRED_BASE_TABLES,
  ensureDatabaseFile,
  seedDatabase,
  readDatabase,
  writeDatabase,
  mutateDatabase,
  healthCheck
};
