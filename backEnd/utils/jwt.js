const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(payload) {
  return jwt.sign(payload, env.auth.jwtSecret, {
    expiresIn: env.auth.jwtExpiresIn
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.auth.jwtSecret);
}

module.exports = {
  signAccessToken,
  verifyAccessToken
};
