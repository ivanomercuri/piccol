import { Request, Response } from 'express';
import logger from '../config/logger';

// ATTENZIONE — bug pre-esistente, scoperto durante questa conversione e
// preservato di proposito (non corretto silenziosamente, come da
// istruzioni): Express riconosce un middleware come error-handler SOLO se
// dichiara ESATTAMENTE 4 parametri (err, req, res, next) — è così che
// decide se instradargli un `next(err)` oppure no. Questa funzione ne ha
// solo 3. A runtime questo significa che `app.use(errorHandler)` in
// index.js NON viene mai chiamato come gestore d'errore: verificato
// empiricamente inviando un body JSON malformato al server in dev, che
// restituisce la pagina HTML di errore di default di Express (stack trace
// incluso) invece del `res.error(400, 'errore json: ...')` documentato in
// CLAUDE.md. Di conseguenza anche `logger.error(...)` qui sotto non scrive
// mai nei log per errori propagati con next(err). TypeScript non segnala
// questo problema (una funzione a 3 argomenti è strutturalmente compatibile
// con un tipo che ne richiede 4, JS permette di chiamarla comunque) — va
// quindi corretto esplicitamente da chi legge questo commento, aggiungendo
// il quarto parametro `next: NextFunction` (anche se inutilizzato), non da
// questa sessione di migrazione.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errorHandler(err: any, req: Request, res: Response) {
  logger.error('Errore:', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  // Cast a `any`: dopo `instanceof SyntaxError`, TypeScript restringe `err`
  // al tipo SyntaxError della lib standard, che non ha `.status` — è
  // body-parser ad aggiungerlo a runtime su questo tipo di errore
  // (estensione non standard, non tipizzabile senza un cast).
  if (
    err instanceof SyntaxError &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  ) {
    return res.error(400, 'errore json: ' + err.message);
  }

  return res.error(
    err.status || 500,
    err.message || 'Qualcosa è andato storto!'
  );
}

module.exports = errorHandler;