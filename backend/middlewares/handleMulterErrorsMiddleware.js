const multer = require('multer');

/**
 * Questo middleware intercetta errori generati da Multer durante il processo di upload.
 * NOTA: il controllo LIMIT_FILE_SIZE è stato spostato in validateProductImageMiddleware
 * per poter associare l'errore al nome del file. Questo middleware gestisce
 * altri eventuali errori di Multer (es. LIMIT_FILE_COUNT, ecc.).
 */
module.exports = (err, req, res, next) => {
  // Gestiamo specificamente gli errori generati da Multer
  if (err instanceof multer.MulterError) {
    req.validationErrors = req.validationErrors || [];

    // Aggiungiamo l'errore alla lista che verrà processata dal validationHandlerMiddleware
    req.validationErrors.push({
      msg: err.message, // Usiamo il messaggio di default fornito da Multer
      filename: err.field || '_generale_', // Usiamo il campo o un placeholder
      path: 'image',
    });

    // Passiamo al prossimo middleware che gestirà la validazione
    return next();
  }

  // Se non è un errore di Multer, lo passiamo al gestore di errori globale
  next(err);
};
