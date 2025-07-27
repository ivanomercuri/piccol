// backend/middlewares/skipIfValidationErrors.js
module.exports = (req, res, next) => {
  if (req.validationErrors) {
    // Salta ai middleware dopo quelli dichiarati nella rotta
    return next();
  }
  next();
};