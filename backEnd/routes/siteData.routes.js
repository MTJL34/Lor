const express = require('express');
const { getSiteData, updateSiteData } = require('../controllers/siteData.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', getSiteData);
router.put('/', requireAuth, updateSiteData);

module.exports = router;
