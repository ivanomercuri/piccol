import { BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Traduce l'errore di un body JSON malformato nel vocabolario di NestJS, nel
 * punto esatto in cui nasce: subito dopo express.json().
 *
 * PERCHÉ ESISTE (e perché non basta l'exception filter)
 * Quando express.json() riceve un body non valido, chiama next(err) con un
 * SyntaxError. Quell'errore arriva al gestore Express che NestJS registra in
 * coda all'app, il quale lo passa a `ExpressAdapter.mapException()`: lì un
 * SyntaxError diventa `new BadRequestException(error.message)` — e l'errore
 * originale si perde (verificato nel sorgente di @nestjs/platform-express
 * 12, express-adapter.js). A valle, l'exception filter vede solo "un 400
 * qualsiasi" e non può più sapere che si trattava di JSON malformato, quindi
 * non potrebbe produrre il messaggio "errore json: ..." che fa parte del
 * contratto API (docs/API.md).
 *
 * La soluzione è tradurre PRIMA che l'informazione vada persa: questo
 * middleware riconosce l'errore del body parser e lo sostituisce con una
 * BadRequestException che porta già il messaggio italiano. Il filter resta
 * generico e non deve conoscere nulla dei dettagli interni di body-parser.
 *
 * NON RIMUOVERE il parametro `next` né nessuno degli altri: come per il
 * vecchio errorMiddleware, Express riconosce un gestore d'errore solo se
 * dichiara ESATTAMENTE 4 parametri. Con 3 verrebbe saltato in silenzio.
 * È presidiato da un test sull'arità.
 *
 * Posizione nella catena: va montato subito dopo express.json() (vedi
 * app.setup.ts). Express fa avanzare un errore solo verso i middleware
 * registrati DOPO quello che l'ha generato, quindi qui arrivano soltanto gli
 * errori del parser — non quelli dei router legacy, montati più avanti.
 */
export function jsonSyntaxErrorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (isBodyParserSyntaxError(err)) {
    return next(new BadRequestException(`errore json: ${err.message}`));
  }

  // Qualunque altro errore prosegue intatto verso il gestore di NestJS.
  next(err);
}

/**
 * Riconosce l'errore specifico di body-parser: un SyntaxError con status 400
 * e con la proprietà `body` (il testo che non è stato possibile parsare).
 * Stessa condizione che usava errorMiddleware.ts. La proprietà `body` è ciò
 * che lo distingue da un SyntaxError nato altrove, ad esempio da un bug in
 * un JSON.parse del codice applicativo, che NON va spacciato per un errore
 * del client.
 *
 * Il tipo di ritorno `err is SyntaxError` è un "type predicate": se la
 * funzione restituisce true, TypeScript restringe il tipo di `err` a
 * SyntaxError nel ramo if del chiamante, così lì si può leggere err.message
 * senza cast. Non ha un equivalente diretto in PHP, dove il restringimento
 * avviene solo con instanceof scritto in linea.
 */
function isBodyParserSyntaxError(err: unknown): err is SyntaxError {
  return (
    err instanceof SyntaxError &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  );
}
