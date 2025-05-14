
// Import express-validator result function
const {validationResult} = require('express-validator');

// Middleware to handle validation errors from express-validator
module.exports = (req, res, next) => {
  // Get validation errors from request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Map errors to a simplified format
    const expressValidatorErrors = errors.array();
    const returnedValidatorErrors = expressValidatorErrors.map(({msg, path}) => ({message: msg, id: path}));
    // Return error response with validation errors
    return res.error(400, returnedValidatorErrors);
  }
  // Proceed to the next middleware or route handler if no errors
  next();
};
