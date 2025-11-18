module.exports = (req, res, next) => {
  if (req.validationErrors) {
    return next();
  }
  next();
};
