const { query, getConnection } = require('../config/database');
const HttpError = require('../utils/HttpError');
const { toSafeInt } = require('../utils/validation');

function mapChampionRow(row) {
  return {
    championId: row.championId,
    championName: row.championName,
    costId: row.costId,
    cost: row.cost,
    poc: Boolean(row.poc),
    championIcon: row.championIcon || '',
    starsId: row.starsId,
    stars: row.stars,
    lorExclusive: Boolean(row.lorExclusive),
    constellationNumberId: row.constellationNumberId,
    constellationNumber: row.constellationNumber,
    levelId: row.levelId,
    level: row.level,
    levelNeeded: row.levelNeeded,
    regionId: row.regionId,
    regionName: row.regionName,
    relics: []
  };
}

async function getRelicSlotsForChampionIds(championIds) {
  if (!championIds.length) {
    return new Map();
  }

  const placeholders = championIds.map(() => '?').join(', ');
  const rows = await query(
    `
    SELECT champion_id AS championId, slot_index AS slotIndex, relic_code AS relicCode
    FROM champion_all_relics
    WHERE champion_id IN (${placeholders})
    ORDER BY champion_id ASC, slot_index ASC
    `,
    championIds
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.championId)) {
      map.set(row.championId, [null, null, null]);
    }

    const slots = map.get(row.championId);
    const idx = Math.max(0, Math.min(2, (row.slotIndex || 1) - 1));
    slots[idx] = row.relicCode || null;
  }

  return map;
}

async function listChampions(filters = {}) {
  const where = [];
  const params = [];

  if (typeof filters.poc === 'boolean') {
    where.push('c.poc = ?');
    params.push(filters.poc ? 1 : 0);
  }

  if (Number.isFinite(filters.regionId)) {
    where.push('c.region_id = ?');
    params.push(filters.regionId);
  }

  if (filters.search) {
    where.push('c.champion_name LIKE ?');
    params.push(`%${filters.search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query(
    `
    SELECT
      c.champion_id AS championId,
      c.champion_name AS championName,
      c.cost_id AS costId,
      co.cost_value AS cost,
      c.poc AS poc,
      c.champion_icon AS championIcon,
      c.stars_id AS starsId,
      s.stars_value AS stars,
      c.lor_exclusive AS lorExclusive,
      c.constellation_number_id AS constellationNumberId,
      cn.constellation_value AS constellationNumber,
      c.level_id AS levelId,
      l.actual_level AS level,
      l.level_needed AS levelNeeded,
      c.region_id AS regionId,
      r.region_name AS regionName
    FROM champion c
    LEFT JOIN cost co ON co.cost_id = c.cost_id
    LEFT JOIN stars s ON s.stars_id = c.stars_id
    LEFT JOIN constellation_number cn ON cn.constellation_id = c.constellation_number_id
    LEFT JOIN level l ON l.level_id = c.level_id
    LEFT JOIN region r ON r.region_id = c.region_id
    ${whereSql}
    ORDER BY c.champion_id ASC
    `,
    params
  );

  const champions = rows.map(mapChampionRow);
  const championIds = champions.map((champion) => champion.championId);

  const relicSlots = await getRelicSlotsForChampionIds(championIds);
  for (const champion of champions) {
    champion.relics = relicSlots.get(champion.championId) || [null, null, null];
  }

  return champions;
}

async function getChampionById(championId) {
  const champs = await listChampions({});
  return champs.find((champion) => champion.championId === championId) || null;
}

async function getNextChampionId(connection) {
  const [rows] = await connection.execute(
    'SELECT COALESCE(MAX(champion_id), 0) + 1 AS nextId FROM champion'
  );
  return rows[0].nextId;
}

function sanitizeRelicsInput(relics) {
  const next = [null, null, null];
  if (!Array.isArray(relics)) {
    return next;
  }

  for (let i = 0; i < 3; i += 1) {
    const value = relics[i];
    next[i] = value === 0 || value === '0' || value === '' ? null : value || null;
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
    poc: payload.poc ? 1 : 0,
    championIcon: payload.championIcon || '',
    starsId: toSafeInt(payload.starsId, 0),
    lorExclusive: payload.lorExclusive ? 1 : 0,
    constellationNumberId: toSafeInt(payload.constellationNumberId, 1),
    levelId: toSafeInt(payload.levelId, 1),
    regionId: toSafeInt(payload.regionId, 13)
  };

  if (!partial) {
    if (!base.championName) {
      throw new HttpError(400, 'Field `championName` is required');
    }
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

async function createChampion(payload) {
  const cleaned = normalizeChampionInput(payload, false);
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const nextChampionId = await getNextChampionId(connection);

    await connection.execute(
      `
      INSERT INTO champion (
        champion_id,
        champion_name,
        cost_id,
        poc,
        champion_icon,
        stars_id,
        lor_exclusive,
        constellation_number_id,
        level_id,
        region_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nextChampionId,
        cleaned.championName,
        cleaned.costId,
        cleaned.poc,
        cleaned.championIcon,
        cleaned.starsId,
        cleaned.lorExclusive,
        cleaned.constellationNumberId,
        cleaned.levelId,
        cleaned.regionId
      ]
    );

    for (let i = 0; i < 3; i += 1) {
      await connection.execute(
        'INSERT INTO champion_all_relics (champion_id, slot_index, relic_code) VALUES (?, ?, ?)',
        [nextChampionId, i + 1, cleaned.relics[i]]
      );
    }

    await connection.commit();
    return nextChampionId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateChampion(championId, payload) {
  const cleaned = normalizeChampionInput(payload, true);
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      'SELECT champion_id FROM champion WHERE champion_id = ? LIMIT 1',
      [championId]
    );

    if (!existingRows.length) {
      throw new HttpError(404, 'Champion not found');
    }

    const fields = [];
    const params = [];

    const mapping = {
      championName: 'champion_name',
      costId: 'cost_id',
      poc: 'poc',
      championIcon: 'champion_icon',
      starsId: 'stars_id',
      lorExclusive: 'lor_exclusive',
      constellationNumberId: 'constellation_number_id',
      levelId: 'level_id',
      regionId: 'region_id'
    };

    for (const [inputKey, dbColumn] of Object.entries(mapping)) {
      if (cleaned[inputKey] !== undefined) {
        fields.push(`${dbColumn} = ?`);
        params.push(cleaned[inputKey]);
      }
    }

    if (fields.length) {
      params.push(championId);
      await connection.execute(
        `UPDATE champion SET ${fields.join(', ')} WHERE champion_id = ?`,
        params
      );
    }

    if (cleaned.relics) {
      await connection.execute(
        'DELETE FROM champion_all_relics WHERE champion_id = ?',
        [championId]
      );
      for (let i = 0; i < 3; i += 1) {
        await connection.execute(
          'INSERT INTO champion_all_relics (champion_id, slot_index, relic_code) VALUES (?, ?, ?)',
          [championId, i + 1, cleaned.relics[i]]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteChampion(championId) {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM champion_all_relics WHERE champion_id = ?', [championId]);
    const [result] = await connection.execute('DELETE FROM champion WHERE champion_id = ?', [championId]);

    if (!result.affectedRows) {
      throw new HttpError(404, 'Champion not found');
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateChampionRelics(championId, relics) {
  const cleanedRelics = sanitizeRelicsInput(relics);
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      'SELECT champion_id FROM champion WHERE champion_id = ? LIMIT 1',
      [championId]
    );

    if (!existingRows.length) {
      throw new HttpError(404, 'Champion not found');
    }

    await connection.execute('DELETE FROM champion_all_relics WHERE champion_id = ?', [championId]);

    for (let i = 0; i < 3; i += 1) {
      await connection.execute(
        'INSERT INTO champion_all_relics (champion_id, slot_index, relic_code) VALUES (?, ?, ?)',
        [championId, i + 1, cleanedRelics[i]]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

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
