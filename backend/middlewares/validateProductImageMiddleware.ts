import { Request, Response, NextFunction } from 'express';
import sizeOf from 'image-size';
import fs from 'fs';
import util from 'util';
import { maxWidth, maxHeight } from '../config/imageConfig';

// Import di DEFAULT, non named: il file .js originale faceva
// `typeof imgSize === 'function' ? imgSize : imgSize.imageSize` per gestire
// forme diverse dell'export CJS/ESM di image-size — con esModuleInterop,
// un import di default fa esattamente lo stesso lavoro automaticamente
// (__importDefault "srotola" un export CJS che è già una funzione invece di
// cercare .default su di esso). Verificato che serviva davvero: con un
// named import (`{ imageSize }`) i test con `jest.mock('image-size', () =>
// jest.fn())` fallivano, perché il mock è una funzione nuda senza una
// proprietà `.imageSize` — esattamente il caso che la vecchia ternary
// gestiva a mano.
const unlinkFile = util.promisify(fs.unlink);

// Cast: process.env.MAX_FILE_SIZE è `string | undefined`, ma parseInt
// richiede una stringa. Nessun controllo esisteva prima su una variabile
// mancante (avrebbe prodotto NaN, propagato silenziosamente nel confronto
// `file.size > softLimitBytes` sempre falso) — comportamento invariato,
// solo reso visibile dal cast invece che nascosto dietro `any` implicito.
const softLimitBytes =
  parseInt(process.env.MAX_FILE_SIZE as string, 10) * 1024 * 1024;

const cleanupFiles = (files: Express.Multer.File[]) => {
  if (files && files.length > 0) {
    files.forEach((file) => {
      unlinkFile(file.path).catch((err) =>
        console.error(`Failed to delete temp file: ${file.path}`, err)
      );
    });
  }
};

module.exports = async (req: Request, res: Response, next: NextFunction) => {
  if (req.validationErrors && req.validationErrors.length > 0 && !req.files) {
    return next();
  }

  // Cast: `req.files` è tipizzato da @types/multer come File[] OPPURE come
  // dizionario { [fieldname]: File[] } (dipende da quale metodo Multer
  // viene usato in fase di routing — .array() vs .fields() — non
  // conoscibile qui). Questa route usa sempre uploadImage.array('image')
  // (verificato in routes/productRoutes.js), quindi è sempre un array a
  // runtime: il cast riflette un fatto verificato, non un'assunzione.
  const files = (req.files || []) as Express.Multer.File[];
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
      } catch {
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