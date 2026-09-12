// errorMiddleware è l'ultimo middleware montato in index.js: qualsiasi
// next(err) chiamato ovunque nell'app finisce qui. Prima di questo file non
// era mai stato testato, nonostante gestisca anche un caso specifico e non
// ovvio (i SyntaxError generati da express.json() su body malformati).
//
// NOTA (fase F0 della migrazione a NestJS): il bug di arità che questo file
// documentava — 3 parametri invece di 4, quindi middleware mai invocato da
// Express come error-handler — è stato CORRETTO. I test qui sotto chiamano
// la funzione DIRETTAMENTE, quindi per costruzione non potevano rilevarlo:
// verificano il comportamento della funzione in isolamento, non il suo
// aggancio alla catena di Express. Quell'aggancio è ora verificato da
// __tests__/errorHandling.test.ts, che passa da una richiesta HTTP vera.
//
// Resta qui, in fondo al file, un test sull'arità: è l'unica proprietà del
// contratto con Express osservabile senza fare una richiesta, e costa nulla.
import { Request, Response, NextFunction } from 'express';

jest.mock('../config/logger', () => ({ error: jest.fn() }));

import logger from '../config/logger';
import errorMiddleware from '../middlewares/errorMiddleware';

describe('errorMiddleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = { originalUrl: '/test', method: 'POST' } as unknown as Request;

    res = { error: jest.fn() } as unknown as Response;

    // `next` non viene usato da errorMiddleware (è un gestore terminale: la
    // risposta parte da qui e non si delega a nessuno), ma va passato perché
    // fa parte della firma richiesta da Express. Lo teniamo come mock per
    // poter verificare esplicitamente che NON venga chiamato.
    next = jest.fn();

    jest.clearAllMocks();
  });

  it('should always log the error via Winston, regardless of its type', () => {
    const err = new Error('Qualcosa si è rotto');

    errorMiddleware(err, req, res, next);

    expect(logger.error).toHaveBeenCalledWith('Errore:', {
      message: err.message,
      stack: err.stack,
      path: '/test',
      method: 'POST',
    });
  });

  it('should respond with err.status and err.message when both are set', () => {
    // Cast a `any`: .status non fa parte del tipo Error standard, è
    // un'estensione non ufficiale usata da Express/middleware come questo.
    const err = new Error('Non autorizzato') as Error & { status?: number };

    err.status = 403;

    errorMiddleware(err, req, res, next);

    expect(res.error).toHaveBeenCalledWith(403, 'Non autorizzato');
  });

  it('should default to 500 and a generic message when status/message are missing', () => {
    // Un errore "vuoto" (nessun .status, nessun .message significativo) non
    // deve mai far trapelare una risposta con status/messaggio undefined al
    // client: deve sempre ricadere sui default.
    const err = new Error();

    errorMiddleware(err, req, res, next);

    expect(res.error).toHaveBeenCalledWith(500, 'Qualcosa è andato storto!');
  });

  it('should normalize a body-parser JSON SyntaxError into a 400', () => {
    // Questo è il caso speciale che express.json() genera quando il body
    // della richiesta non è JSON valido: un SyntaxError con .status === 400
    // e una proprietà `body` aggiunta da body-parser. Senza questo ramo
    // finirebbe nel default 500, fuorviante per un errore causato dal client.
    const err = new SyntaxError('Unexpected token in JSON') as SyntaxError & {
      status?: number;
      body?: string;
    };

    err.status = 400;

    err.body = '{not valid json';

    errorMiddleware(err, req, res, next);

    expect(res.error).toHaveBeenCalledWith(
      400,
      'errore json: Unexpected token in JSON'
    );
  });

  it('should NOT treat a generic SyntaxError without a body property as a JSON parse error', () => {
    // Un SyntaxError può capitare anche per altri motivi (es. un bug nel
    // codice applicativo): senza la proprietà `body` non deve essere
    // confuso con un errore di parsing del body della richiesta.
    const err = new SyntaxError('Unrelated syntax error') as SyntaxError & {
      status?: number;
    };

    err.status = 400;

    errorMiddleware(err, req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, 'Unrelated syntax error');
  });

  // Presidio del contratto con Express, non della logica applicativa.
  //
  // Express decide se un middleware è un error-handler contando i parametri
  // che dichiara (fn.length): con 4 gli instrada un next(err), con 3 lo
  // tratta come middleware ordinario e non lo chiama mai. È precisamente il
  // bug che è vissuto in questo file per mesi senza che nessuno dei test
  // sopra potesse accorgersene, perché chiamano la funzione direttamente.
  //
  // Questo test fallisce subito se qualcuno "ripulisce" il parametro next
  // perché sembra inutilizzato — cosa che un linter può legittimamente
  // suggerire, e che romperebbe di nuovo tutta la gestione degli errori in
  // silenzio.
  it('dichiara 4 parametri, altrimenti Express non lo riconosce come error-handler', () => {
    expect(errorMiddleware.length).toBe(4);
  });

  // Contropartita del commento su `next` nel beforeEach: errorMiddleware è
  // un gestore terminale. Se delegasse a next(), Express passerebbe al
  // gestore di default dopo che la risposta è già stata inviata, con un
  // "Cannot set headers after they are sent".
  it('non delega a next: è un gestore terminale', () => {
    errorMiddleware(new Error('boom'), req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});