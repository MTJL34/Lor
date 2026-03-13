const HttpError = require('./HttpError');

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSafeNonNegativeInt(value, fallback = 0) {
  const parsed = toSafeInt(value, fallback);
  return parsed < 0 ? fallback : parsed;
}

function parseBooleanQuery(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  return null;
}

function requireString(value, fieldName, { min = 1, max = 255 } = {}) {
  if (typeof value !== 'string') {
    throw new HttpError(400, `Field \`${fieldName}\` must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new HttpError(400, `Field \`${fieldName}\` must be at least ${min} characters`);
  }

  if (trimmed.length > max) {
    throw new HttpError(400, `Field \`${fieldName}\` must be at most ${max} characters`);
  }

  return trimmed;
}

module.exports = {
  isObject,
  toSafeInt,
  toSafeNonNegativeInt,
  parseBooleanQuery,
  requireString
};
