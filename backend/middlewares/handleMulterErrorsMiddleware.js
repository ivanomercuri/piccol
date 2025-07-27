const InvalidImageTypeError = require('../classes/InvalidImageTypeError');

module.exports = (err, req, res, next) => {
  if (err instanceof InvalidImageTypeError ) {
    req.multerError = {
      id: err.field,
      message: err.message
    };
    return next(); // Non rispondi subito
  }

  next(err); // altri errori reali
};
