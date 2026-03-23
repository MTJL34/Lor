const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env')
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

function parseIntOrDefault(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseIntOrDefault(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseIntOrDefault(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'POC'
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me-in-env',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: parseIntOrDefault(process.env.BCRYPT_ROUNDS, 10),
    allowGuestAuth: parseBool(process.env.ALLOW_GUEST_AUTH, true)
  },
  legal: {
    termsVersion: process.env.TERMS_VERSION || '2026-03',
    privacyPolicyVersion: process.env.PRIVACY_POLICY_VERSION || '2026-03',
    dataRetentionDays: parseIntOrDefault(process.env.DATA_RETENTION_DAYS, 365)
  }
};

module.exports = env;
