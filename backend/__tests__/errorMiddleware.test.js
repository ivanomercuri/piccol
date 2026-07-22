// errorMiddleware è l'ultimo middleware montato in index.js: qualsiasi
// next(err) chiamato ovunque nell'app finisce qui. Prima di questo file non
// era mai stato testato, nonostante gestisca anche un caso specifico e non
// ovvio (i SyntaxError generati da express.json() su body malformati).
jest.mock('../config/logger', () => ({ error: jest.fn() }));

const logger = require('../config/logger');
const errorMiddleware = require('../middlewares/errorMiddleware');

describe('errorMiddleware', () => {
  let req, res;

  beforeEach(() => {
    req = { originalUrl: '/test', method: 'POST' };

    res = { error: jest.fn() };

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
    const err = new Error('Non autorizzato');

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

    expect(res.error).toHaveBeenCalledWith(
      500,
      'Qualcosa è andato storto!'
    );
  });

  it('should normalize a body-parser JSON SyntaxError into a 400', () => {
    // Questo è il caso speciale che express.json() genera quando il body
    // della richiesta non è JSON valido: un SyntaxError con .status === 400
    // e una proprietà `body` aggiunta da body-parser. Senza questo ramo
    // finirebbe nel default 500, fuorviante per un errore causato dal client.
    const err = new SyntaxError('Unexpected token in JSON');

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
    const err = new SyntaxError('Unrelated syntax error');

    err.status = 400;

    errorMiddleware(err, req, res);

    expect(res.error).toHaveBeenCalledWith(400, 'Unrelated syntax error');
  });
});