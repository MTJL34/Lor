const dbNameToSiteDataName = {
  'Shadow Isles': 'Îles Obscures'
};

const siteDataNameToDbName = {
  'Îles Obscures': 'Shadow Isles',
  'ÃŽles Obscures': 'Shadow Isles'
};

function toSiteDataRegionName(dbName) {
  return dbNameToSiteDataName[dbName] || dbName;
}

function toDbRegionName(siteDataName) {
  return siteDataNameToDbName[siteDataName] || siteDataName;
}

module.exports = {
  toSiteDataRegionName,
  toDbRegionName
};
