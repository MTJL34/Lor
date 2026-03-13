const express = require('express');
const {
  list,
  detail,
  create,
  update,
  remove,
  updateRelics
} = require('../controllers/champion.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', list);
router.get('/:championId', detail);
router.post('/', requireAuth, create);
router.put('/:championId', requireAuth, update);
router.delete('/:championId', requireAuth, remove);
router.put('/:championId/relics', requireAuth, updateRelics);

module.exports = router;
