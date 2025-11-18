const logger = require('../config/logger');

function errorHandler(err, req, res) {
  logger.error('Errore:', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.error(400, 'errore json: ' + err.message);
  }

  return res.error(
    err.status || 500,
    err.message || 'Qualcosa è andato storto!'
  );
}

module.exports = errorHandler;
