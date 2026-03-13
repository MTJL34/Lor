const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { query } = require('../config/database');
const env = require('../config/env');
const HttpError = require('../utils/HttpError');
const { signAccessToken } = require('../utils/jwt');
const { ensureUserInventoryRows } = require('./inventory.service');

function toPublicUser(userRow) {
  return {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    createdAt: userRow.created_at
  };
}

async function getUserByLogin(login) {
  const rows = await query(
    `
    SELECT id, username, email, password_hash, created_at
    FROM users
    WHERE email = ? OR username = ?
    LIMIT 1
    `,
    [login, login]
  );

  return rows[0] || null;
}

async function createUser({ username, email, password }) {
  const existing = await getUserByLogin(email);
  if (existing && existing.email === email) {
    throw new HttpError(409, 'Email already used');
  }

  const existingByUsername = await getUserByLogin(username);
  if (existingByUsername && existingByUsername.username === username) {
    throw new HttpError(409, 'Username already used');
  }

  const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);

  const result = await query(
    `
    INSERT INTO users (username, email, password_hash)
    VALUES (?, ?, ?)
    `,
    [username, email, passwordHash]
  );

  const userId = result.insertId;
  const userRows = await query(
    'SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  await ensureUserInventoryRows(userId);

  const user = userRows[0];
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

  await ensureUserInventoryRows(user.id);

  const token = signAccessToken({ sub: user.id, username: user.username, email: user.email });

  return {
    token,
    user: toPublicUser(user)
  };
}

async function getUserById(userId) {
  const rows = await query(
    'SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (!rows.length) {
    throw new HttpError(404, 'User not found');
  }

  return toPublicUser(rows[0]);
}

async function ensureGuestUser() {
  const guestEmail = 'guest@lor.local';
  let guestUsername = 'guest';

  const existing = await query(
    'SELECT id, username, email, created_at FROM users WHERE email = ? LIMIT 1',
    [guestEmail]
  );

  if (existing.length) {
    await ensureUserInventoryRows(existing[0].id);
    return toPublicUser(existing[0]);
  }

  const passwordHash = await bcrypt.hash(crypto.randomUUID(), env.auth.bcryptRounds);

  try {
    const result = await query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [guestUsername, guestEmail, passwordHash]
    );

    const rows = await query(
      'SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    await ensureUserInventoryRows(rows[0].id);
    return toPublicUser(rows[0]);
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') {
      throw error;
    }

    const rows = await query(
      'SELECT id, username, email, created_at FROM users WHERE email = ? LIMIT 1',
      [guestEmail]
    );

    if (!rows.length) {
      guestUsername = `guest_${Date.now()}`;
      const retryResult = await query(
        'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
        [guestUsername, guestEmail, passwordHash]
      );
      const retryRows = await query(
        'SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1',
        [retryResult.insertId]
      );
      await ensureUserInventoryRows(retryRows[0].id);
      return toPublicUser(retryRows[0]);
    }

    await ensureUserInventoryRows(rows[0].id);
    return toPublicUser(rows[0]);
  }
}

module.exports = {
  createUser,
  loginUser,
  getUserById,
  ensureGuestUser
};
