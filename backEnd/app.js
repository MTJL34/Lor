const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
const apiRoutes = require('./routes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const frontEndDir = path.resolve(__dirname, '../frontEnd');
const frontEndIndex = path.join(frontEndDir, 'index.html');

function buildCorsOptions() {
  if (env.corsOrigin === '*') {
    return { origin: true, credentials: true };
  }

  const allowed = env.corsOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin(origin, callback) {
      if (!origin || allowed.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS not allowed'));
    },
    credentials: true
  };
}

app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api', (req, res) => {
  res.json({
    name: 'LoR API',
    version: '1.0.0',
    docs: '/api/health',
    app: '/'
  });
});

app.use('/api', apiRoutes);
app.use(express.static(frontEndDir));

app.get(/^(?!\/api(?:\/|$))(?!.*\.[^/]+$).*/, (req, res) => {
  res.sendFile(frontEndIndex);
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
