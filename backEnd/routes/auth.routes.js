const express = require('express');
const { register, login, me, updateConsent } = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.patch('/consent', requireAuth, updateConsent);

module.exports = router;
