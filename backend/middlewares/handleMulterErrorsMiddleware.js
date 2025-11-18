const InvalidImageTypeError = require('../classes/InvalidImageTypeError');

module.exports = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    req.validationErrors = req.validationErrors || [];

    req.validationErrors.push({
      msg: 'Il file supera la dimensione massima di 2 MB',
      path: 'image',
    });

    return next();
  }
  next(err);
};
