module.exports = function checkNumberFiles( field, max, customMessage = null ) {
  return (req, res, next) => {
    req.validationErrors = req.validationErrors || [];

    const files = (req.files || []).filter(f => f.fieldname === field);
    const count = files.length;

    if (max !== null && count > max) {
      req.validationErrors.push({
        msg: customMessage || `Caricare al massimo ${max} file`,
        path: field
      });
    }

    next();
  };
};
