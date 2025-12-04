const multer = require('multer');

/**
 * Questo middleware intercetta errori "fatali" generati da Multer.
 * Se l'errore è un superamento dell'hard limit, lo contrassegna come "fatale"
 * per essere gestito in via prioritaria.
 */
module.exports = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    req.validationErrors = req.validationErrors || [];
    let errorMessage = err.message;
    const hardLimitMB = 10; // Coerente con uploadMiddleware
    let isFatal = false;

    // Se l'errore è il superamento dell'hard limit, lo consideriamo un evento di sicurezza.
    if (err.code === 'LIMIT_FILE_SIZE') {
      errorMessage = `Operazione non permessa.`;

      isFatal = true; // Contrassegniamo l'errore come fatale.
    }

    req.validationErrors.push({
      msg: errorMessage,
      isFatal: isFatal, // Aggiungiamo il flag all'oggetto errore.
    });

    // Continuiamo il flusso per permettere al validationHandler di gestire la risposta.
    return next();
  }

  // Se non è un errore di Multer, lo passiamo al gestore di errori globale.
  next(err);
};
