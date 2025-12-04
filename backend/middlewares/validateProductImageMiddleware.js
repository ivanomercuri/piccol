const imgSize = require('image-size');
const fs = require('fs');
const util = require('util');
const { maxWidth, maxHeight } = require('../config/imageConfig');

const sizeOf = typeof imgSize === 'function' ? imgSize : imgSize.imageSize;
const unlinkFile = util.promisify(fs.unlink);

const softLimitBytes = parseInt(process.env.MAX_FILE_SIZE, 10) * 1024 * 1024;

const cleanupFiles = (files) => {
  if (files && files.length > 0) {
    files.forEach((file) => {
      unlinkFile(file.path).catch((err) =>
        console.error(`Failed to delete temp file: ${file.path}`, err)
      );
    });
  }
};

module.exports = async (req, res, next) => {
  if (req.validationErrors && req.validationErrors.length > 0 && !req.files) {
    return next();
  }

  const files = req.files || [];
  const imageField = 'image';

  req.validationErrors = req.validationErrors || [];

  if (files.length === 0 && req.validationErrors.length === 0) {
    req.validationErrors.push({
      msg: "L'immagine del prodotto è richiesta",
      path: imageField,
      filename: '_generale_',
    });

    return next();
  }

  for (const file of files) {
    if (file.size > softLimitBytes) {
      req.validationErrors.push({
        msg: `Il file supera la dimensione massima di ${process.env.MAX_FILE_SIZE} MB`,
        path: imageField,
        filename: file.originalname,
      });
      continue;
    }

    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      try {
        // FIX: Leggiamo esplicitamente il file dal disco per ottenere un Buffer.
        // La libreria image-size sta erroneamente interpretando la stringa del percorso
        // come un buffer, causando un crash. Fornendogli direttamente un buffer
        // risolviamo il problema in modo robusto.
        const buffer = fs.readFileSync(file.path);
        const dimensions = sizeOf(buffer);

        if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
          req.validationErrors.push({
            msg: `Le dimensioni non possono superare ${maxWidth}x${maxHeight}px`,
            path: imageField,
            filename: file.originalname,
          });
        }
      } catch (err) {
        // Questo catch ora gestisce sia file corrotti che l'errore che hai trovato.
        req.validationErrors.push({
          msg: 'Il file è corrotto o non è un formato di immagine valido',
          path: imageField,
          filename: file.originalname,
        });
      }
    }
  }

  if (req.validationErrors.length > 0) {
    cleanupFiles(files);
  }

  next();
};
