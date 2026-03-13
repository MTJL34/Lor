const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { parseBooleanQuery, toSafeInt } = require('../utils/validation');
const {
  listChampions,
  getChampionById,
  createChampion,
  updateChampion,
  deleteChampion,
  updateChampionRelics
} = require('../services/champion.service');

const list = asyncHandler(async (req, res) => {
  const poc = parseBooleanQuery(req.query.poc);
  const regionId = req.query.regionId !== undefined ? toSafeInt(req.query.regionId, NaN) : NaN;

  const data = await listChampions({
    poc,
    regionId: Number.isFinite(regionId) ? regionId : undefined,
    search: req.query.search ? String(req.query.search).trim() : ''
  });

  res.json({ count: data.length, data });
});

const detail = asyncHandler(async (req, res) => {
  const championId = toSafeInt(req.params.championId, NaN);
  if (!Number.isFinite(championId)) {
    throw new HttpError(400, 'Invalid championId');
  }

  const champion = await getChampionById(championId);
  if (!champion) {
    throw new HttpError(404, 'Champion not found');
  }

  res.json({ data: champion });
});

const create = asyncHandler(async (req, res) => {
  const championId = await createChampion(req.body || {});
  const champion = await getChampionById(championId);
  res.status(201).json({ data: champion });
});

const update = asyncHandler(async (req, res) => {
  const championId = toSafeInt(req.params.championId, NaN);
  if (!Number.isFinite(championId)) {
    throw new HttpError(400, 'Invalid championId');
  }

  await updateChampion(championId, req.body || {});
  const champion = await getChampionById(championId);
  res.json({ data: champion });
});

const remove = asyncHandler(async (req, res) => {
  const championId = toSafeInt(req.params.championId, NaN);
  if (!Number.isFinite(championId)) {
    throw new HttpError(400, 'Invalid championId');
  }

  await deleteChampion(championId);
  res.status(204).send();
});

const updateRelics = asyncHandler(async (req, res) => {
  const championId = toSafeInt(req.params.championId, NaN);
  if (!Number.isFinite(championId)) {
    throw new HttpError(400, 'Invalid championId');
  }

  const relics = await updateChampionRelics(championId, req.body && req.body.relics);
  res.json({
    data: {
      championId,
      relics
    }
  });
});

module.exports = {
  list,
  detail,
  create,
  update,
  remove,
  updateRelics
};
