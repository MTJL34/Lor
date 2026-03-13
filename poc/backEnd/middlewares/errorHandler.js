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

  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Duplicate entry'
    });
  }

  if (err && err.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      error: 'DatabaseError',
      message: 'A required database table is missing. Run `npm run db:setup` first.'
    });
  }

  console.error('[UNHANDLED_ERROR]', err);
  return res.status(500).json({
    error: 'InternalServerError',
    message: 'Unexpected server error'
  });
}

module.exports = errorHandler;
