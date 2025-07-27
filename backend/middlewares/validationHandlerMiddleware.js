const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const errors = validationResult(req).array();
  const extraErrors = req.validationErrors || [];

  let allErrors = [...errors, ...extraErrors];

  const requiredFilesInfo = req.requiredFilesInfo || new Map();
  const presentFiles = req.files || [];

  for (const [field, { label, customMessage }] of requiredFilesInfo.entries()) {
    const alreadyHasError = allErrors.some(e => e.path === field);
    const found = presentFiles.some(f => f.fieldname === field);

    if (!alreadyHasError && !found) {
      allErrors.push({
        msg: customMessage || `Il file ${label} è richiesto`,
        path: field
      });
    }
  }

  // Unico errore per ogni campo
  const uniqueErrors = [];
  const seen = new Set();
  for (const err of allErrors) {
    const key = err.path;
    if (!seen.has(key)) {
      uniqueErrors.push(err);
      seen.add(key);
    }
  }

  if (uniqueErrors.length > 0) {
    return res.error(400, uniqueErrors.map(({ msg, path }) => ({ id: path, message: msg })));
  }

  next();
};
