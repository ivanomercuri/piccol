const {validationResult} = require('express-validator');

module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const expressValidatorErrors = errors.array();
    const returnedValidatorErrors = expressValidatorErrors.map(({msg, path}) => ({message: msg, id: path}));
    return res.error(400, returnedValidatorErrors);
  }
  next();
};
