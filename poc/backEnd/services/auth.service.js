const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../config/database');
const env = require('../config/env');
const HttpError = require('../utils/HttpError');
const { signAccessToken } = require('../utils/jwt');
const { ensureUserInventoryRows } = require('./inventory.service');

const PUBLIC_USER_FIELDS = `
  id,
  username,
  email,
  created_at,
  last_login_at,
  is_guest,
  terms_version_accepted,
  terms_accepted_at,
  privacy_version_accepted,
  privacy_accepted_at,
  marketing_consent,
  marketing_consent_updated_at,
  data_retention_until
`;

function toBool(value) {
  return value === true || value === 1;
}

function computeRetentionDeadline() {
  const retentionDays = Number.isFinite(env.legal.dataRetentionDays) && env.legal.dataRetentionDays > 0
    ? env.legal.dataRetentionDays
    : 365;

  const now = Date.now();
  return new Date(now + (retentionDays * 24 * 60 * 60 * 1000));
}

function buildComplianceSnapshot({ marketingConsent = false } = {}) {
  const acceptedAt = new Date();
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

function toPublicUser(userRow) {
  return {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    createdAt: userRow.created_at,
    lastLoginAt: userRow.last_login_at || null,
    isGuest: toBool(userRow.is_guest),
    legal: {
      termsVersionAccepted: userRow.terms_version_accepted || null,
      termsAcceptedAt: userRow.terms_accepted_at || null,
      privacyVersionAccepted: userRow.privacy_version_accepted || null,
      privacyAcceptedAt: userRow.privacy_accepted_at || null,
      marketingConsent: toBool(userRow.marketing_consent),
      marketingConsentUpdatedAt: userRow.marketing_consent_updated_at || null,
      dataRetentionUntil: userRow.data_retention_until || null
    }
  };
}

async function getUserByLogin(login) {
  const rows = await query(
    `
    SELECT
      ${PUBLIC_USER_FIELDS},
      password_hash
    FROM users
    WHERE email = ? OR username = ?
    LIMIT 1
    `,
    [login, login]
  );

  return rows[0] || null;
}

async function appendUserAuditLog(userId, eventType, eventPayload = null) {
  const payload = eventPayload ? JSON.stringify(eventPayload) : null;

  try {
    await query(
      `
      INSERT INTO user_audit_log (user_id, event_type, event_payload)
      VALUES (?, ?, ?)
      `,
      [userId, eventType, payload]
    );
  } catch (error) {
    // Best effort: user flows should not fail if audit persistence is temporarily unavailable.
    console.warn(`[audit] Failed to log ${eventType}:`, error.message);
  }
}

async function getPublicUserRowById(userId) {
  const rows = await query(
    `
    SELECT ${PUBLIC_USER_FIELDS}
    FROM users
    WHERE id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

async function createUser({ username, email, password, consent }) {
  if (!consent || consent.termsAccepted !== true || consent.privacyAccepted !== true) {
    throw new HttpError(400, 'Terms and privacy policy consent are required');
  }

  const existing = await getUserByLogin(email);
  if (existing && existing.email === email) {
    throw new HttpError(409, 'Email already used');
  }

  const existingByUsername = await getUserByLogin(username);
  if (existingByUsername && existingByUsername.username === username) {
    throw new HttpError(409, 'Username already used');
  }

  const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);
  const compliance = buildComplianceSnapshot({
    marketingConsent: consent.marketingConsent
  });

  const result = await query(
    `
    INSERT INTO users (
      username,
      email,
      password_hash,
      terms_version_accepted,
      terms_accepted_at,
      privacy_version_accepted,
      privacy_accepted_at,
      marketing_consent,
      marketing_consent_updated_at,
      data_retention_until,
      is_guest
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `,
    [
      username,
      email,
      passwordHash,
      compliance.termsVersionAccepted,
      compliance.termsAcceptedAt,
      compliance.privacyVersionAccepted,
      compliance.privacyAcceptedAt,
      compliance.marketingConsent,
      compliance.marketingConsentUpdatedAt,
      compliance.dataRetentionUntil
    ]
  );

  const userId = result.insertId;
  await ensureUserInventoryRows(userId);

  const user = await getPublicUserRowById(userId);
  if (!user) {
    throw new HttpError(500, 'User registration failed');
  }

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
  const user = await getUserByLogin(login);
  if (!user) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const retentionUntil = computeRetentionDeadline();
  await query(
    `
    UPDATE users
    SET
      last_login_at = UTC_TIMESTAMP(),
      data_retention_until = ?
    WHERE id = ?
    `,
    [retentionUntil, user.id]
  );

  await ensureUserInventoryRows(user.id);

  const refreshedUser = await getPublicUserRowById(user.id);
  if (!refreshedUser) {
    throw new HttpError(404, 'User not found');
  }

  await appendUserAuditLog(refreshedUser.id, 'auth.login', {
    isGuest: toBool(refreshedUser.is_guest)
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
  const user = await getPublicUserRowById(userId);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  return toPublicUser(user);
}

async function updateUserMarketingConsent(userId, marketingConsent) {
  const existing = await query(
    'SELECT id, is_guest FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (!existing.length) {
    throw new HttpError(404, 'User not found');
  }

  if (toBool(existing[0].is_guest)) {
    throw new HttpError(403, 'Guest account cannot change consent');
  }

  await query(
    `
    UPDATE users
    SET
      marketing_consent = ?,
      marketing_consent_updated_at = UTC_TIMESTAMP()
    WHERE id = ?
    `,
    [toBool(marketingConsent), userId]
  );

  const updated = await getPublicUserRowById(userId);
  if (!updated) {
    throw new HttpError(404, 'User not found');
  }

  await appendUserAuditLog(updated.id, 'auth.marketing_consent_updated', {
    marketingConsent: toBool(marketingConsent)
  });

  return toPublicUser(updated);
}

async function ensureGuestUser() {
  const guestEmail = 'guest@lor.local';
  let guestUsername = 'guest';

  const existing = await query(`SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE email = ? LIMIT 1`, [guestEmail]);

  if (existing.length) {
    const retentionUntil = computeRetentionDeadline();
    await query(
      `
      UPDATE users
      SET
        is_guest = 1,
        last_login_at = UTC_TIMESTAMP(),
        data_retention_until = ?
      WHERE id = ?
      `,
      [retentionUntil, existing[0].id]
    );

    await appendUserAuditLog(existing[0].id, 'auth.guest_login');
    await ensureUserInventoryRows(existing[0].id);

    const refreshed = await getPublicUserRowById(existing[0].id);
    return toPublicUser(refreshed || existing[0]);
  }

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), env.auth.bcryptRounds);
  const compliance = buildComplianceSnapshot();

  try {
    const result = await query(
      `
      INSERT INTO users (
        username,
        email,
        password_hash,
        terms_version_accepted,
        terms_accepted_at,
        privacy_version_accepted,
        privacy_accepted_at,
        marketing_consent,
        marketing_consent_updated_at,
        data_retention_until,
        is_guest
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)
      `,
      [
        guestUsername,
        guestEmail,
        passwordHash,
        compliance.termsVersionAccepted,
        compliance.termsAcceptedAt,
        compliance.privacyVersionAccepted,
        compliance.privacyAcceptedAt,
        compliance.marketingConsentUpdatedAt,
        compliance.dataRetentionUntil
      ]
    );

    await appendUserAuditLog(result.insertId, 'auth.guest_created');

    await ensureUserInventoryRows(result.insertId);
    const created = await getPublicUserRowById(result.insertId);
    if (!created) {
      throw new HttpError(500, 'Guest user creation failed');
    }

    return toPublicUser(created);
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') {
      throw error;
    }

    const rows = await query(`SELECT ${PUBLIC_USER_FIELDS} FROM users WHERE email = ? LIMIT 1`, [guestEmail]);

    if (!rows.length) {
      guestUsername = `guest_${Date.now()}`;
      const retryResult = await query(
        `
        INSERT INTO users (
          username,
          email,
          password_hash,
          terms_version_accepted,
          terms_accepted_at,
          privacy_version_accepted,
          privacy_accepted_at,
          marketing_consent,
          marketing_consent_updated_at,
          data_retention_until,
          is_guest
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)
        `,
        [
          guestUsername,
          guestEmail,
          passwordHash,
          compliance.termsVersionAccepted,
          compliance.termsAcceptedAt,
          compliance.privacyVersionAccepted,
          compliance.privacyAcceptedAt,
          compliance.marketingConsentUpdatedAt,
          compliance.dataRetentionUntil
        ]
      );
      await appendUserAuditLog(retryResult.insertId, 'auth.guest_created');
      await ensureUserInventoryRows(retryResult.insertId);

      const retryUser = await getPublicUserRowById(retryResult.insertId);
      if (!retryUser) {
        throw new HttpError(500, 'Guest user creation failed');
      }

      return toPublicUser(retryUser);
    }

    await appendUserAuditLog(rows[0].id, 'auth.guest_login');
    await ensureUserInventoryRows(rows[0].id);
    return toPublicUser(rows[0]);
  }
}

module.exports = {
  createUser,
  loginUser,
  getUserById,
  updateUserMarketingConsent,
  ensureGuestUser
};
