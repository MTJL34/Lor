const asyncHandler = require('../utils/asyncHandler');
const HttpError = require('../utils/HttpError');
const { requireString, requireBoolean } = require('../utils/validation');
const {
  createUser,
  loginUser,
  getUserById,
  updateUserMarketingConsent
} = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const username = requireString(req.body.username, 'username', { min: 3, max: 100 });
  const email = requireString(req.body.email, 'email', { min: 5, max: 191 }).toLowerCase();
  const password = requireString(req.body.password, 'password', { min: 6, max: 255 });
  const termsAccepted = requireBoolean(req.body.termsAccepted, 'termsAccepted');
  const privacyAccepted = requireBoolean(req.body.privacyAccepted, 'privacyAccepted');

  if (!termsAccepted) {
    throw new HttpError(400, 'Field `termsAccepted` must be true');
  }

  if (!privacyAccepted) {
    throw new HttpError(400, 'Field `privacyAccepted` must be true');
  }

  const marketingConsent = req.body.marketingConsent === undefined
    ? false
    : requireBoolean(req.body.marketingConsent, 'marketingConsent');

  const result = await createUser({
    username,
    email,
    password,
    consent: {
      termsAccepted,
      privacyAccepted,
      marketingConsent
    }
  });
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const loginValue = requireString(req.body.login, 'login', { min: 3, max: 191 });
  const password = requireString(req.body.password, 'password', { min: 6, max: 255 });

  const result = await loginUser({ login: loginValue, password });
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const user = await getUserById(req.auth.sub);
  res.json({ user });
});

const updateConsent = asyncHandler(async (req, res) => {
  const marketingConsent = requireBoolean(req.body.marketingConsent, 'marketingConsent');
  const user = await updateUserMarketingConsent(req.auth.sub, marketingConsent);
  res.json({ user });
});

module.exports = {
  register,
  login,
  me,
  updateConsent
};
