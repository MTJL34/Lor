const asyncHandler = require('../utils/asyncHandler');
const {
  getRegions,
  getCosts,
  getStars,
  getLevels,
  getConstellations
} = require('../services/meta.service');

const regions = asyncHandler(async (req, res) => {
  res.json({ data: await getRegions() });
});

const costs = asyncHandler(async (req, res) => {
  res.json({ data: await getCosts() });
});

const stars = asyncHandler(async (req, res) => {
  res.json({ data: await getStars() });
});

const levels = asyncHandler(async (req, res) => {
  res.json({ data: await getLevels() });
});

const constellations = asyncHandler(async (req, res) => {
  res.json({ data: await getConstellations() });
});

module.exports = {
  regions,
  costs,
  stars,
  levels,
  constellations
};
