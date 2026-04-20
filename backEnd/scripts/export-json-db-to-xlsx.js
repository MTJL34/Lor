const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { readDatabase, getDatabaseFile } = require('../config/database');

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildTimestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join('');
}

function encodeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatCellValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function isNumericValue(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberToColumnName(number) {
  let current = number;
  let result = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function flattenRecord(value, prefix = '', target = {}) {
  if (value === null || value === undefined) {
    if (prefix) {
      target[prefix] = '';
    }
    return target;
  }

  if (Array.isArray(value)) {
    target[prefix] = JSON.stringify(value);
    return target;
  }

  if (typeof value !== 'object') {
    target[prefix] = value;
    return target;
  }

  const entries = Object.entries(value);
  if (entries.length === 0 && prefix) {
    target[prefix] = '';
    return target;
  }

  for (const [key, nestedValue] of entries) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenRecord(nestedValue, nextPrefix, target);
  }

  return target;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildSheets(database, databaseFile) {
  const siteData = database.catalog && database.catalog.siteData ? database.catalog.siteData : {};
  const siteRegions = siteData.regions && typeof siteData.regions === 'object' ? siteData.regions : {};
  const siteResources = siteData.resources && typeof siteData.resources === 'object' ? siteData.resources : {};
  const siteRegionalResources = siteResources.regional && typeof siteResources.regional === 'object'
    ? siteResources.regional
    : {};
  const appStates = ensureArray(database.userAppStates);

  const sheets = [];

  sheets.push({
    name: 'overview',
    rows: [
      {
        exportedAt: new Date().toISOString(),
        databaseFile,
        users: ensureArray(database.users).length,
        userInventories: ensureArray(database.userInventories).length,
        userAppStates: appStates.length,
        userAuditLog: ensureArray(database.userAuditLog).length,
        catalog_regions: ensureArray(database.catalog && database.catalog.regions).length,
        catalog_costs: ensureArray(database.catalog && database.catalog.costs).length,
        catalog_stars: ensureArray(database.catalog && database.catalog.stars).length,
        catalog_levels: ensureArray(database.catalog && database.catalog.levels).length,
        catalog_constellations: ensureArray(database.catalog && database.catalog.constellations).length,
        catalog_relics: ensureArray(database.catalog && database.catalog.relics).length,
        catalog_champions: ensureArray(database.catalog && database.catalog.champions).length,
        site_regions: Object.keys(siteRegions).length
      }
    ]
  });

  sheets.push({
    name: 'meta',
    rows: [flattenRecord(database.meta || {})]
  });

  sheets.push({
    name: 'users',
    rows: ensureArray(database.users).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'userInventories',
    rows: ensureArray(database.userInventories).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'userAppStates',
    rows: appStates.map((row) => ({
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.appState && row.appState.version,
      options: row.appState && row.appState.options ? JSON.stringify(row.appState.options) : '',
      appStateJson: row.appState ? JSON.stringify(row.appState) : ''
    }))
  });

  sheets.push({
    name: 'appState_inventory',
    rows: appStates.flatMap((row) => {
      const inventoryByRegion = row.appState && row.appState.inventoryByRegion && typeof row.appState.inventoryByRegion === 'object'
        ? row.appState.inventoryByRegion
        : {};

      return Object.entries(inventoryByRegion).map(([regionName, inventory]) => ({
        userId: row.userId,
        regionName,
        ...flattenRecord(inventory || {})
      }));
    })
  });

  sheets.push({
    name: 'appState_customChamps',
    rows: appStates.flatMap((row) => {
      const customChampions = row.appState && row.appState.customChampions && typeof row.appState.customChampions === 'object'
        ? row.appState.customChampions
        : {};

      return Object.entries(customChampions).flatMap(([regionName, champions]) =>
        ensureArray(champions).map((champion, championIndex) => ({
          userId: row.userId,
          regionName,
          championIndex,
          ...flattenRecord(champion || {})
        }))
      );
    })
  });

  sheets.push({
    name: 'appState_pocRelics',
    rows: appStates.flatMap((row) => {
      const customRelics = row.appState
        && row.appState.pocData
        && Array.isArray(row.appState.pocData.customRelics)
        ? row.appState.pocData.customRelics
        : [];

      return customRelics.map((relic, relicIndex) => ({
        userId: row.userId,
        relicIndex,
        ...flattenRecord(relic || {})
      }));
    })
  });

  sheets.push({
    name: 'appState_pocChamps',
    rows: appStates.flatMap((row) => {
      const customChampions = row.appState
        && row.appState.pocData
        && Array.isArray(row.appState.pocData.customChampions)
        ? row.appState.pocData.customChampions
        : [];

      return customChampions.map((champion, championIndex) => ({
        userId: row.userId,
        championIndex,
        ...flattenRecord(champion || {})
      }));
    })
  });

  sheets.push({
    name: 'appState_pocOverrides',
    rows: appStates.flatMap((row) => {
      const championOverrides = row.appState
        && row.appState.pocData
        && row.appState.pocData.championOverrides
        && typeof row.appState.pocData.championOverrides === 'object'
        ? row.appState.pocData.championOverrides
        : {};

      return Object.entries(championOverrides).map(([championId, override]) => ({
        userId: row.userId,
        championId,
        ...flattenRecord(override || {})
      }));
    })
  });

  sheets.push({
    name: 'userAuditLog',
    rows: ensureArray(database.userAuditLog).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'catalog_regions',
    rows: ensureArray(database.catalog && database.catalog.regions).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'catalog_costs',
    rows: ensureArray(database.catalog && database.catalog.costs).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'catalog_stars',
    rows: ensureArray(database.catalog && database.catalog.stars).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'catalog_levels',
    rows: ensureArray(database.catalog && database.catalog.levels).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'catalog_constellations',
    rows: ensureArray(database.catalog && database.catalog.constellations).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'catalog_relics',
    rows: ensureArray(database.catalog && database.catalog.relics).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'catalog_champions',
    rows: ensureArray(database.catalog && database.catalog.champions).map((row) => flattenRecord(row))
  });

  sheets.push({
    name: 'site_resources',
    rows: Object.entries(siteRegionalResources).map(([resourceKey, resourceValue]) => ({
      resourceKey,
      ...flattenRecord(resourceValue || {})
    }))
  });

  sheets.push({
    name: 'site_regions',
    rows: Object.entries(siteRegions).map(([regionName, regionValue]) => ({
      regionName,
      championCount: ensureArray(regionValue && regionValue.champions).length,
      ...flattenRecord({
        totals: regionValue && regionValue.totals ? regionValue.totals : {},
        inventory_default: regionValue && regionValue.inventory_default ? regionValue.inventory_default : {}
      })
    }))
  });

  sheets.push({
    name: 'site_region_champs',
    rows: Object.entries(siteRegions).flatMap(([regionName, regionValue]) =>
      ensureArray(regionValue && regionValue.champions).map((champion, championIndex) => ({
        regionName,
        championIndex,
        ...flattenRecord(champion || {})
      }))
    )
  });

  return sheets;
}

function sanitizeSheetName(name, usedNames) {
  const safeBase = String(name || 'Sheet')
    .replace(/[\\/*?:[\]]/g, '_')
    .slice(0, 31) || 'Sheet';

  let candidate = safeBase;
  let suffix = 1;

  while (usedNames.has(candidate)) {
    const suffixText = `_${suffix}`;
    candidate = `${safeBase.slice(0, 31 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function buildSheetXml(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const headerSet = new Set();

  for (const row of normalizedRows) {
    Object.keys(row || {}).forEach((key) => headerSet.add(key));
  }

  const headers = [...headerSet];
  const allRows = headers.length === 0
    ? []
    : [
      headers,
      ...normalizedRows.map((row) => headers.map((header) => row && header in row ? row[header] : ''))
    ];

  const rowXml = allRows.map((values, rowIndex) => {
    const cellXml = values.map((value, columnIndex) => {
      const cellRef = `${numberToColumnName(columnIndex + 1)}${rowIndex + 1}`;

      if (isNumericValue(value)) {
        return `<c r="${cellRef}"><v>${value}</v></c>`;
      }

      const stringValue = formatCellValue(value);
      return `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${encodeXml(stringValue)}</t></is></c>`;
    }).join('');

    return `<row r="${rowIndex + 1}">${cellXml}</row>`;
  }).join('');

  const lastColumn = headers.length > 0 ? numberToColumnName(headers.length) : 'A';
  const lastRow = Math.max(allRows.length, 1);
  const dimension = `${'A1'}:${lastColumn}${lastRow}`;

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<dimension ref="${dimension}"/>`,
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>',
    '<sheetFormatPr defaultRowHeight="15"/>',
    '<sheetData>',
    rowXml,
    '</sheetData>',
    '</worksheet>'
  ].join('');
}

async function writeFileRecursive(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function buildWorkbook(outputPath) {
  const database = await readDatabase();
  const databaseFile = getDatabaseFile();
  const rawSheets = buildSheets(database, databaseFile);
  const usedNames = new Set();
  const sheets = rawSheets.map((sheet, index) => ({
    ...sheet,
    index: index + 1,
    safeName: sanitizeSheetName(sheet.name, usedNames)
  }));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lor-xlsx-'));

  try {
    const workbookXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<sheets>',
      ...sheets.map((sheet) => (
        `<sheet name="${encodeXml(sheet.safeName)}" sheetId="${sheet.index}" r:id="rId${sheet.index}"/>`
      )),
      '</sheets>',
      '</workbook>'
    ].join('');

    const workbookRelsXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      ...sheets.map((sheet) => (
        `<Relationship Id="rId${sheet.index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheet.index}.xml"/>`
      )),
      '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
      '</Relationships>'
    ].join('');

    const contentTypesXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
      ...sheets.map((sheet) => (
        `<Override PartName="/xl/worksheets/sheet${sheet.index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )),
      '</Types>'
    ].join('');

    const rootRelsXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
      '</Relationships>'
    ].join('');

    const nowIso = new Date().toISOString();
    const coreXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      '<dc:creator>Codex</dc:creator>',
      '<cp:lastModifiedBy>Codex</cp:lastModifiedBy>',
      '<dcterms:created xsi:type="dcterms:W3CDTF">' + encodeXml(nowIso) + '</dcterms:created>',
      '<dcterms:modified xsi:type="dcterms:W3CDTF">' + encodeXml(nowIso) + '</dcterms:modified>',
      '<dc:title>LoR database export</dc:title>',
      '</cp:coreProperties>'
    ].join('');

    const appXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
      '<Application>Codex</Application>',
      `<TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map((sheet) => `<vt:lpstr>${encodeXml(sheet.safeName)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts>`,
      '</Properties>'
    ].join('');

    const stylesXml = [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>',
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>',
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
      '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>',
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
      '</styleSheet>'
    ].join('');

    await writeFileRecursive(path.join(tempDir, '[Content_Types].xml'), contentTypesXml);
    await writeFileRecursive(path.join(tempDir, '_rels/.rels'), rootRelsXml);
    await writeFileRecursive(path.join(tempDir, 'docProps/core.xml'), coreXml);
    await writeFileRecursive(path.join(tempDir, 'docProps/app.xml'), appXml);
    await writeFileRecursive(path.join(tempDir, 'xl/workbook.xml'), workbookXml);
    await writeFileRecursive(path.join(tempDir, 'xl/_rels/workbook.xml.rels'), workbookRelsXml);
    await writeFileRecursive(path.join(tempDir, 'xl/styles.xml'), stylesXml);

    for (const sheet of sheets) {
      await writeFileRecursive(
        path.join(tempDir, `xl/worksheets/sheet${sheet.index}.xml`),
        buildSheetXml(sheet.rows)
      );
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.rm(outputPath, { force: true });
    execFileSync('zip', ['-qr', outputPath, '.'], { cwd: tempDir });

    return {
      outputPath,
      databaseFile,
      sheetCount: sheets.length,
      sheets: sheets.map((sheet) => ({
        name: sheet.safeName,
        rows: Array.isArray(sheet.rows) ? sheet.rows.length : 0
      }))
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const outputArgIndex = process.argv.indexOf('--output');
  const outputPath = outputArgIndex !== -1 && process.argv[outputArgIndex + 1]
    ? path.resolve(process.cwd(), process.argv[outputArgIndex + 1])
    : path.resolve(process.cwd(), `backEnd/data/exports/lor-database-export-${buildTimestamp()}.xlsx`);

  const result = await buildWorkbook(outputPath);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
