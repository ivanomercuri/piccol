module.exports = (req, res, next) => {
  res.success = (data, message = '', code = 200) => {
    res.status(code).json({
      success: true,
      status: code,
      data,
      message,
    });
  };

  res.error = (code = 500, message = '') => {
    res.status(code).json({
      success: false,
      status: code,
      data: null,
      error: message,
    });
  };

  next();
};