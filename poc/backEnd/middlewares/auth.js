const HttpError = require('../utils/HttpError');
const env = require('../config/env');
const { verifyAccessToken } = require('../utils/jwt');
const { ensureGuestUser } = require('../services/auth.service');

function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }

  const [scheme, token] = headerValue.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

async function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    if (!env.auth.allowGuestAuth) {
      return next(new HttpError(401, 'Missing Bearer token'));
    }

    try {
      const guestUser = await ensureGuestUser();
      req.auth = {
        sub: guestUser.id,
        username: guestUser.username,
        email: guestUser.email,
        guest: true
      };
      return next();
    } catch (error) {
      return next(error);
    }
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = payload;
    return next();
  } catch (error) {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
}

module.exports = {
  requireAuth
};
