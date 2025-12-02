const imgSize = require('image-size');
const { maxWidth, maxHeight } = require('#image-config');
const sizeOf = typeof imgSize === 'function' ? imgSize : imgSize.imageSize;

// Leggiamo la dimensione massima dal file di ambiente
const maxSizeInBytes = parseInt(process.env.MAX_FILE_SIZE, 10) * 1024 * 1024;

module.exports = (req, res, next) => {
  // Inizializza l'array degli errori se non esiste già
  req.validationErrors = req.validationErrors || [];

  const files = req.files || [];
  const imageField = 'image';

  // Se non ci sono file e non ci sono già errori di altro tipo,
  // aggiungiamo l'errore di file mancante.
  if (files.length === 0 && req.validationErrors.length === 0) {
    req.validationErrors.push({
      msg: "L'immagine del prodotto è richiesta",
      path: imageField,
      filename: '_generale_', // Usiamo un placeholder
    });

    return next(); // Passiamo al gestore di validazione
  }

  for (const file of files) {
    // 1. Controllo sulla dimensione del file (precedentemente in Multer)
    if (file.size > maxSizeInBytes) {
      req.validationErrors.push({
        msg: `Il file supera la dimensione massima di ${process.env.MAX_FILE_SIZE} MB`,
        path: imageField,
        filename: file.originalname,
      });
      // Continuiamo il ciclo per controllare anche gli altri file
      continue;
    }

    // 2. Controllo sulle dimensioni dell'immagine (larghezza x altezza)
    // Questo blocco viene eseguito solo se il file è un'immagine valida.
    // Gli errori di tipo file (es. PDF) sono già stati aggiunti in uploadMiddleware.
    /* ------------------------------------------------------------------
        | NOTA IMPORTANTE: Questo controllo del mimetype NON è ridondante.
        | Sebbene uploadMiddleware abbia già validato il tipo, ha lasciato passare
        | i file non validi (es. PDF) per raccogliere gli errori senza bloccare il flusso.
        | Dobbiamo filtrare nuovamente qui perché la libreria 'image-size' andrebbe
        | in crash (o darebbe errori fuorvianti) se provasse a leggere il buffer di un PDF.
        | ------------------------------------------------------------------*/
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      try {
        const dimensions = sizeOf(file.buffer);

        if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
          req.validationErrors.push({
            msg: `Le dimensioni dell'immagine non possono superare ${maxWidth}x${maxHeight}px`,
            path: imageField,
            filename: file.originalname,
          });
        }
      } catch (err) {
        // Questo catch gestisce file corrotti che sembrano immagini ma non lo sono.
        req.validationErrors.push({
          msg: 'Il file è corrotto o non è un formato di immagine valido',
          path: imageField,
          filename: file.originalname,
        });
      }
    }
  }

  next();
};
