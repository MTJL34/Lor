const express = require('express');
const {
  regions,
  costs,
  stars,
  levels,
  constellations
} = require('../controllers/meta.controller');

const router = express.Router();

router.get('/regions', regions);
router.get('/costs', costs);
router.get('/stars', stars);
router.get('/levels', levels);
router.get('/constellations', constellations);

module.exports = router;
