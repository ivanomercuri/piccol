const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const errors = validationResult(req).array();
  const extraErrors = req.validationErrors || [];

  const allErrors = [...errors, ...extraErrors];

  if (allErrors.length > 0) {
    // --- GESTIONE ERRORE FATALE ---
    // Cerchiamo se tra gli errori ce n'è uno contrassegnato come "fatale".
    const fatalError = allErrors.find((err) => err.isFatal);

    if (fatalError) {
      return res.error(400, fatalError.msg);
    }
    // --- FINE GESTIONE ERRORE FATALE ---

    // Se non ci sono errori fatali, procediamo con la logica di raggruppamento standard.
    const groupedErrors = allErrors.reduce((acc, error) => {
      const { path, msg, filename } = error;

      if (path === 'image') {
        if (!acc.image) {
          acc.image = { id: 'image', message: [] };
        }
        const currentFilename = filename || '_generale_';
        const hasErrorForFile = acc.image.message.some(
          (imgError) => imgError.filename === currentFilename
        );

        if (!hasErrorForFile) {
          acc.image.message.push({
            filename: currentFilename,
            message: msg,
          });
        }
      } else {
        if (!acc[path]) {
          acc[path] = { id: path, message: msg };
        }
      }

      return acc;
    }, {});

    const finalErrors = Object.values(groupedErrors);

    return res.error(400, finalErrors);
  }

  next();
};
