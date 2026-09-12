import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

// NON RIMUOVERE il quarto parametro `next`, anche se non viene usato.
//
// Express distingue un error-handler da un middleware normale contando gli
// argomenti dichiarati dalla funzione (fn.length): solo con ESATTAMENTE 4
// parametri (err, req, res, next) gli instrada un `next(err)`. Con 3, come
// era scritto fino alla fase F0 della migrazione a NestJS, `app.use()` lo
// registrava come middleware ordinario e non veniva mai invocato: un body
// JSON malformato riceveva la pagina HTML di errore di default di Express —
// stack trace incluso — invece della risposta 400 nel formato del progetto,
// e nessun errore propagato con next(err) finiva nei log di Winston.
//
// TypeScript non protegge da questo: una funzione a 3 argomenti è
// strutturalmente compatibile con un tipo che ne richiede 4, quindi il
// compilatore resta zitto. Il presidio è il test end-to-end in
// __tests__/errorHandling.test.ts, che passa da una richiesta HTTP vera e
// quindi rileva il problema di aggancio che un test sulla funzione isolata
// non può vedere.
//
// Nota per la migrazione: in NestJS questo vincolo non esiste più. Un
// exception filter viene riconosciuto tramite il decoratore @Catch(), non
// contando i parametri, quindi questa classe di bug diventa
// irrappresentabile.
//
// Il parametro `next` non ha bisogno di una direttiva eslint: la config del
// progetto lo ignora già fra i parametri non usati
// (argsIgnorePattern: 'next|^_' in eslint.config.js).
function errorHandler(
  // La direttiva sta qui e non sopra `function`: `disable-next-line` vale
  // per la riga immediatamente successiva, e con la firma spezzata su più
  // righe quella successiva a `function` non è più quella con `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
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

export = errorHandler;