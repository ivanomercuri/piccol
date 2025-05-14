
// Middleware to format API responses with success and error helpers
module.exports = (req, res, next) => {
  // Helper for successful responses
  res.success = (data, message = '', code = 200) => {
    res.status(code).json({
      success: true,
      status: code,
      data,
      message,
    });
  };

  // Helper for error responses
  res.error = (code = 500, message = '') => {
    res.status(code).json({
      success: false,
      status: code,
      data: null,
      error: message,
    });
  };

  // Proceed to the next middleware or route handler
  next();
};
