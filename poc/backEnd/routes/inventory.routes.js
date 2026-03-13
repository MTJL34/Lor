const express = require('express');
const {
  list,
  updateRegion,
  craft,
  importState,
  exportState
} = require('../controllers/inventory.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', list);
router.put('/region/:regionId', updateRegion);
router.post('/region/:regionId/craft', craft);
router.post('/import', importState);
router.get('/export', exportState);

module.exports = router;
