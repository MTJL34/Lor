const HttpError = require('../utils/HttpError');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      details: err.details || undefined
    });
  }

  if (err && err.code === 'ENOENT') {
    return res.status(500).json({
      error: 'DatabaseError',
      message: 'JSON database file is missing. Run `npm run db:setup` first.'
    });
  }

  if (err instanceof SyntaxError) {
    return res.status(500).json({
      error: 'DatabaseError',
      message: 'JSON database file is invalid. Run `npm run db:setup` first.'
    });
  }

  console.error('[UNHANDLED_ERROR]', err);
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'Unexpected server error'
  });
}

module.exports = errorHandler;
