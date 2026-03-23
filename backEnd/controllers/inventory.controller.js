const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { toSafeInt } = require('../utils/validation');
const {
  getUserInventory,
  upsertUserRegionInventory,
  craftNovaCrystal,
  importAppState,
  exportAppState
} = require('../services/inventory.service');

const list = asyncHandler(async (req, res) => {
  const data = await getUserInventory(req.auth.sub);
  res.json(data);
});

const updateRegion = asyncHandler(async (req, res) => {
  const regionId = toSafeInt(req.params.regionId, NaN);
  if (!Number.isFinite(regionId)) {
    throw new HttpError(400, 'Invalid regionId');
  }

  const row = await upsertUserRegionInventory(req.auth.sub, regionId, req.body || {});
  res.json({ data: row });
});

const craft = asyncHandler(async (req, res) => {
  const regionId = toSafeInt(req.params.regionId, NaN);
  if (!Number.isFinite(regionId)) {
    throw new HttpError(400, 'Invalid regionId');
  }

  const amount = toSafeInt(req.body && req.body.amount, NaN);
  if (!Number.isFinite(amount)) {
    throw new HttpError(400, 'Invalid amount');
  }

  const result = await craftNovaCrystal(req.auth.sub, regionId, amount);
  res.json({ data: result });
});

const importState = asyncHandler(async (req, res) => {
  const appState = req.body && req.body.appState;
  if (!appState || typeof appState !== 'object') {
    throw new HttpError(400, 'Field `appState` is required');
  }

  const result = await importAppState(req.auth.sub, appState);
  res.json({ data: result });
});

const exportState = asyncHandler(async (req, res) => {
  const payload = await exportAppState(req.auth.sub);
  res.json(payload);
});

module.exports = {
  list,
  updateRegion,
  craft,
  importState,
  exportState
};
