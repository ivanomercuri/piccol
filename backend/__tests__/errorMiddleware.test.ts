// errorMiddleware è l'ultimo middleware montato in index.js: qualsiasi
// next(err) chiamato ovunque nell'app finisce qui. Prima di questo file non
// era mai stato testato, nonostante gestisca anche un caso specifico e non
// ovvio (i SyntaxError generati da express.json() su body malformati).
//
// NOTA (Fase 2.6): errorMiddleware.ts dichiara solo 3 parametri (err, req,
// res) invece dei 4 richiesti da Express per essere riconosciuto come
// error-handler — bug pre-esistente, documentato in CHECKPOINT.md e
// docs/API.md, non corretto. Questo test lo chiama DIRETTAMENTE (bypassando
// il dispatch di Express), quindi continua a funzionare a prescindere dal
// bug: verifica il comportamento della funzione in isolamento, non il suo
// effettivo aggancio nella catena di middleware di Express.
import { Request, Response } from 'express';

jest.mock('../config/logger', () => ({ error: jest.fn() }));

import logger from '../config/logger';
import errorMiddleware from '../middlewares/errorMiddleware';

describe('errorMiddleware', () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = { originalUrl: '/test', method: 'POST' } as unknown as Request;

    res = { error: jest.fn() } as unknown as Response;

    jest.clearAllMocks();
  });

  it('should always log the error via Winston, regardless of its type', () => {
    const err = new Error('Qualcosa si è rotto');

    errorMiddleware(err, req, res);

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

    errorMiddleware(err, req, res);

    expect(res.error).toHaveBeenCalledWith(403, 'Non autorizzato');
  });

  it('should default to 500 and a generic message when status/message are missing', () => {
    // Un errore "vuoto" (nessun .status, nessun .message significativo) non
    // deve mai far trapelare una risposta con status/messaggio undefined al
    // client: deve sempre ricadere sui default.
    const err = new Error();

    errorMiddleware(err, req, res);

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

    errorMiddleware(err, req, res);

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

    errorMiddleware(err, req, res);

    expect(res.error).toHaveBeenCalledWith(400, 'Unrelated syntax error');
  });
});