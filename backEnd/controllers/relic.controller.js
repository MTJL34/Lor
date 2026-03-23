const asyncHandler = require('../utils/asyncHandler');
const { getRelics } = require('../services/relic.service');

const list = asyncHandler(async (req, res) => {
  const rarity = req.query.rarity ? String(req.query.rarity).trim() : null;
  const data = await getRelics({ rarity });
  res.json({ count: data.length, data });
});

module.exports = {
  list
};
