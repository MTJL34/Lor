const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const metaRoutes = require('./meta.routes');
const championRoutes = require('./champion.routes');
const relicRoutes = require('./relic.routes');
const inventoryRoutes = require('./inventory.routes');
const siteDataRoutes = require('./siteData.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/meta', metaRoutes);
router.use('/champions', championRoutes);
router.use('/relics', relicRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/site-data', siteDataRoutes);

module.exports = router;
