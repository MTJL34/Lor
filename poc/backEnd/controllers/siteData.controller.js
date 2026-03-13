const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { getSiteDataPayload, saveSiteDataPayload } = require('../services/siteData.service');

const getSiteData = asyncHandler(async (req, res) => {
  const payload = await getSiteDataPayload();
  res.json({ data: payload });
});

const updateSiteData = asyncHandler(async (req, res) => {
  const payload = req.body && req.body.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new HttpError(400, 'Field `payload` must be an object');
  }

  await saveSiteDataPayload(payload);
  res.json({ success: true });
});

module.exports = {
  getSiteData,
  updateSiteData
};
