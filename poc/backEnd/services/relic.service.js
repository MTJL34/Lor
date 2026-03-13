const { query } = require('../config/database');

async function getRelics({ rarity = null } = {}) {
  const params = [];
  let whereClause = '';

  if (rarity) {
    whereClause = 'WHERE relic_rarity = ?';
    params.push(rarity);
  }

  try {
    return query(
      `
      SELECT
        relic_id AS relicId,
        relic_name AS relicName,
        relic_rarity AS relicRarity,
        relic_description AS relicDescription,
        relic_icon AS relicIcon
      FROM all_relics
      ${whereClause}
      ORDER BY relic_rarity ASC, relic_name ASC
      `,
      params
    );
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      throw error;
    }

    const baseSql = `
      SELECT relic_id, relic_name, relic_rarity, relic_description, relic_icon FROM relics_common
      UNION ALL
      SELECT relic_id, relic_name, relic_rarity, relic_description, relic_icon FROM relics_rare
      UNION ALL
      SELECT relic_id, relic_name, relic_rarity, relic_description, relic_icon FROM relics_epic
    `;

    return query(
      `
      SELECT
        relic_id AS relicId,
        relic_name AS relicName,
        relic_rarity AS relicRarity,
        relic_description AS relicDescription,
        relic_icon AS relicIcon
      FROM (
        ${baseSql}
      ) relics
      ${whereClause}
      ORDER BY relic_rarity ASC, relic_name ASC
      `,
      params
    );
  }
}

module.exports = {
  getRelics
};
