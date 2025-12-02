const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
  const errors = validationResult(req).array();
  const extraErrors = req.validationErrors || [];

  // Uniamo tutti gli errori
  const allErrors = [...errors, ...extraErrors];

  if (allErrors.length > 0) {
    const groupedErrors = allErrors.reduce((acc, error) => {
      const { path, msg, filename } = error;

      // Caso speciale: per il campo 'image', accumuliamo gli errori per file.
      if (path === 'image') {
        // Se è il primo errore per 'image', inizializziamo la struttura.
        if (!acc.image) {
          acc.image = { id: 'image', message: [] };
        }

        const currentFilename = filename || '_generale_';
        // Controlliamo se esiste già un errore per questo specifico filename.
        const hasErrorForFile = acc.image.message.some(
          (imgError) => imgError.filename === currentFilename
        );

        // Se non c'è ancora un errore per questo file, lo aggiungiamo.
        // Altrimenti, lo ignoriamo per evitare duplicati.
        if (!hasErrorForFile) {
          acc.image.message.push({
            filename: currentFilename,
            message: msg,
          });
        }
      } else {
        // Caso standard: per tutti gli altri campi, registriamo solo il primo errore.
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
