import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Forma comune usata per unire gli errori di express-validator con quelli
// accumulati a mano su req.validationErrors (vedi CLAUDE.md → "Pattern di
// accumulo degli errori di validazione"): le due fonti hanno tipi reali
// diversi (ValidationError di express-validator è un'unione discriminata
// con forme diverse per campo/alternativa/gruppo, la nostra è un oggetto
// piatto), ma il codice le tratta sempre in modo intercambiabile leggendo
// solo msg/path/filename/isFatal — esattamente i campi di questa
// interfaccia, usata per unificarle.
interface MergedValidationError {
  msg: string;
  path?: string;
  filename?: string;
  isFatal?: boolean;
}

interface GroupedError {
  id: string;
  message: string | Array<{ filename: string; message: string }>;
}

module.exports = (req: Request, res: Response, next: NextFunction) => {
  // Cast: gli oggetti reali restituiti da express-validator hanno più
  // campi/forme di MergedValidationError, ma tutti quelli che il codice
  // legge davvero (msg, path) sono presenti — isFatal/filename restano
  // semplicemente `undefined` per questi errori, comportamento invariato.
  const errors = validationResult(
    req
  ).array() as unknown as MergedValidationError[];
  const extraErrors: MergedValidationError[] = req.validationErrors || [];

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
    const groupedErrors = allErrors.reduce(
      (acc: Record<string, GroupedError>, error) => {
        const { path, msg, filename } = error;

        if (path === 'image') {
          if (!acc.image) {
            acc.image = { id: 'image', message: [] };
          }
          const currentFilename = filename || '_generale_';
          const imageMessages = acc.image.message as Array<{
            filename: string;
            message: string;
          }>;
          const hasErrorForFile = imageMessages.some(
            (imgError) => imgError.filename === currentFilename
          );

          if (!hasErrorForFile) {
            imageMessages.push({
              filename: currentFilename,
              message: msg,
            });
          }
        } else {
          // Cast: `path` è tipizzato `string | undefined`, ma qui viene
          // usato com'era nel file .js originale, senza controllo — se
          // `path` fosse undefined, JS lo userebbe comunque come chiave
          // (coercizione a "undefined"), comportamento invariato.
          const key = path as string;

          if (!acc[key]) {
            acc[key] = { id: key, message: msg };
          }
        }

        return acc;
      },
      {}
    );

    const finalErrors = Object.values(groupedErrors);

    return res.error(400, finalErrors);
  }

  next();
};