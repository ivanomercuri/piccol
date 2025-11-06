module.exports = (req, res, next) => {
  req.requireImage = true;
  if (req.multerFileErrors?.length) {
    req.validationErrors = req.validationErrors || [];
    req.validationErrors.push(...req.multerFileErrors);
  }
  next();
};
