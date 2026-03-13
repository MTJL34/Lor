const asyncHandler = require('../utils/asyncHandler');
const { requireString } = require('../utils/validation');
const { createUser, loginUser, getUserById } = require('../services/auth.service');

const register = asyncHandler(async (req, res) => {
  const username = requireString(req.body.username, 'username', { min: 3, max: 100 });
  const email = requireString(req.body.email, 'email', { min: 5, max: 191 }).toLowerCase();
  const password = requireString(req.body.password, 'password', { min: 6, max: 255 });

  const result = await createUser({ username, email, password });
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

module.exports = {
  register,
  login,
  me
};
