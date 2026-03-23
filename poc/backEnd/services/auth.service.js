const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { readDatabase, mutateDatabase } = require('../config/database');
const env = require('../config/env');
const HttpError = require('../utils/HttpError');
const { signAccessToken } = require('../utils/jwt');
const { ensureUserInventoryRows } = require('./inventory.service');

function toBool(value) {
  return value === true || value === 1;
}

function normalizeUserId(userId) {
  const parsed = Number.parseInt(userId, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function getUserCollection(database) {
  if (!Array.isArray(database.users)) {
    database.users = [];
  }

  return database.users;
}

function getAuditCollection(database) {
  if (!Array.isArray(database.userAuditLog)) {
    database.userAuditLog = [];
  }

  return database.userAuditLog;
}

function getNextId(rows) {
  return rows.reduce((maxId, row) => Math.max(maxId, row.id || 0), 0) + 1;
}

function computeRetentionDeadline() {
  const retentionDays = Number.isFinite(env.legal.dataRetentionDays) && env.legal.dataRetentionDays > 0
    ? env.legal.dataRetentionDays
    : 365;

  const now = Date.now();
  return new Date(now + (retentionDays * 24 * 60 * 60 * 1000)).toISOString();
}

function buildComplianceSnapshot({ marketingConsent = false } = {}) {
  const acceptedAt = new Date().toISOString();

  return {
    termsVersionAccepted: env.legal.termsVersion,
    termsAcceptedAt: acceptedAt,
    privacyVersionAccepted: env.legal.privacyPolicyVersion,
    privacyAcceptedAt: acceptedAt,
    marketingConsent: toBool(marketingConsent),
    marketingConsentUpdatedAt: acceptedAt,
    dataRetentionUntil: computeRetentionDeadline()
  };
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
    isGuest: toBool(user.isGuest),
    legal: {
      termsVersionAccepted: user.termsVersionAccepted || null,
      termsAcceptedAt: user.termsAcceptedAt || null,
      privacyVersionAccepted: user.privacyVersionAccepted || null,
      privacyAcceptedAt: user.privacyAcceptedAt || null,
      marketingConsent: toBool(user.marketingConsent),
      marketingConsentUpdatedAt: user.marketingConsentUpdatedAt || null,
      dataRetentionUntil: user.dataRetentionUntil || null
    }
  };
}

function getUserByLoginFromDatabase(database, login) {
  return getUserCollection(database).find(
    (user) => user.email === login || user.username === login
  ) || null;
}

function getUserByEmailFromDatabase(database, email) {
  return getUserCollection(database).find((user) => user.email === email) || null;
}

function getUserByUsernameFromDatabase(database, username) {
  return getUserCollection(database).find((user) => user.username === username) || null;
}

function getUserByIdFromDatabase(database, userId) {
  return getUserCollection(database).find((user) => user.id === userId) || null;
}

async function appendUserAuditLog(userId, eventType, eventPayload = null) {
  try {
    await mutateDatabase((database) => {
      const logs = getAuditCollection(database);
      logs.push({
        id: getNextId(logs),
        userId: Number.isFinite(normalizeUserId(userId)) ? normalizeUserId(userId) : null,
        eventType,
        eventPayload,
        createdAt: new Date().toISOString()
      });
    });
  } catch (error) {
    console.warn(`[audit] Failed to log ${eventType}:`, error.message);
  }
}

async function createUser({ username, email, password, consent }) {
  if (!consent || consent.termsAccepted !== true || consent.privacyAccepted !== true) {
    throw new HttpError(400, 'Terms and privacy policy consent are required');
  }

  const database = await readDatabase();

  if (getUserByEmailFromDatabase(database, email)) {
    throw new HttpError(409, 'Email already used');
  }

  if (getUserByUsernameFromDatabase(database, username)) {
    throw new HttpError(409, 'Username already used');
  }

  const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);
  const compliance = buildComplianceSnapshot({
    marketingConsent: consent.marketingConsent
  });

  const user = await mutateDatabase((nextDatabase) => {
    if (getUserByEmailFromDatabase(nextDatabase, email)) {
      throw new HttpError(409, 'Email already used');
    }

    if (getUserByUsernameFromDatabase(nextDatabase, username)) {
      throw new HttpError(409, 'Username already used');
    }

    const users = getUserCollection(nextDatabase);
    const now = new Date().toISOString();
    const createdUser = {
      id: getNextId(users),
      username,
      email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      isGuest: false,
      ...compliance
    };

    users.push(createdUser);
    return createdUser;
  });

  await ensureUserInventoryRows(user.id);

  await appendUserAuditLog(user.id, 'auth.register', {
    termsVersion: compliance.termsVersionAccepted,
    privacyVersion: compliance.privacyVersionAccepted,
    marketingConsent: compliance.marketingConsent
  });

  const token = signAccessToken({ sub: user.id, username: user.username, email: user.email });

  return {
    token,
    user: toPublicUser(user)
  };
}

async function loginUser({ login, password }) {
  const database = await readDatabase();
  const user = getUserByLoginFromDatabase(database, login);

  if (!user) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const refreshedUser = await mutateDatabase((nextDatabase) => {
    const currentUser = getUserByIdFromDatabase(nextDatabase, user.id);

    if (!currentUser) {
      throw new HttpError(404, 'User not found');
    }

    currentUser.lastLoginAt = new Date().toISOString();
    currentUser.dataRetentionUntil = computeRetentionDeadline();
    currentUser.updatedAt = new Date().toISOString();

    return currentUser;
  });

  await ensureUserInventoryRows(refreshedUser.id);

  await appendUserAuditLog(refreshedUser.id, 'auth.login', {
    isGuest: toBool(refreshedUser.isGuest)
  });

  const token = signAccessToken({
    sub: refreshedUser.id,
    username: refreshedUser.username,
    email: refreshedUser.email
  });

  return {
    token,
    user: toPublicUser(refreshedUser)
  };
}

async function getUserById(userId) {
  const normalizedUserId = normalizeUserId(userId);
  const database = await readDatabase();
  const user = getUserByIdFromDatabase(database, normalizedUserId);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return toPublicUser(user);
}

async function updateUserMarketingConsent(userId, marketingConsent) {
  const normalizedUserId = normalizeUserId(userId);

  const updatedUser = await mutateDatabase((database) => {
    const user = getUserByIdFromDatabase(database, normalizedUserId);

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    if (toBool(user.isGuest)) {
      throw new HttpError(403, 'Guest account cannot change consent');
    }

    user.marketingConsent = toBool(marketingConsent);
    user.marketingConsentUpdatedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    return user;
  });

  await appendUserAuditLog(updatedUser.id, 'auth.marketing_consent_updated', {
    marketingConsent: toBool(marketingConsent)
  });

  return toPublicUser(updatedUser);
}

async function ensureGuestUser() {
  const guestEmail = 'guest@lor.local';
  const database = await readDatabase();
  const existingUser = getUserByEmailFromDatabase(database, guestEmail);

  if (existingUser) {
    const refreshedGuest = await mutateDatabase((nextDatabase) => {
      const guestUser = getUserByEmailFromDatabase(nextDatabase, guestEmail);

      if (!guestUser) {
        throw new HttpError(404, 'Guest user not found');
      }

      guestUser.isGuest = true;
      guestUser.lastLoginAt = new Date().toISOString();
      guestUser.dataRetentionUntil = computeRetentionDeadline();
      guestUser.updatedAt = new Date().toISOString();

      return guestUser;
    });

    await appendUserAuditLog(refreshedGuest.id, 'auth.guest_login');
    await ensureUserInventoryRows(refreshedGuest.id);
    return toPublicUser(refreshedGuest);
  }

  const compliance = buildComplianceSnapshot();
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), env.auth.bcryptRounds);

  const guestResult = await mutateDatabase((nextDatabase) => {
    const users = getUserCollection(nextDatabase);
    const alreadyCreated = getUserByEmailFromDatabase(nextDatabase, guestEmail);

    if (alreadyCreated) {
      return {
        user: alreadyCreated,
        created: false
      };
    }

    let guestUsername = 'guest';
    let suffix = 0;

    while (getUserByUsernameFromDatabase(nextDatabase, guestUsername)) {
      suffix += 1;
      guestUsername = `guest_${suffix}`;
    }

    const now = new Date().toISOString();
    const guestUser = {
      id: getNextId(users),
      username: guestUsername,
      email: guestEmail,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      isGuest: true,
      ...compliance
    };

    users.push(guestUser);
    return {
      user: guestUser,
      created: true
    };
  });

  const auditEvent = guestResult.created ? 'auth.guest_created' : 'auth.guest_login';
  await appendUserAuditLog(guestResult.user.id, auditEvent);
  await ensureUserInventoryRows(guestResult.user.id);

  return toPublicUser(guestResult.user);
}

module.exports = {
  createUser,
  loginUser,
  getUserById,
  updateUserMarketingConsent,
  ensureGuestUser
};
