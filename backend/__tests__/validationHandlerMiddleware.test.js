// validationHandlerMiddleware è il punto in cui confluiscono sia gli errori
// di express-validator sia quelli accumulati manualmente su
// req.validationErrors (pattern descritto in CLAUDE.md per l'upload
// immagini). È probabilmente il middleware con più logica non banale di
// tutto il progetto (raggruppamento per campo, caso speciale per le
// immagini, scorciatoia per gli errori "fatali") ed era completamente privo
// di test.
//
// Mockiamo express-validator per controllare esattamente cosa restituisce
// validationResult(req).array() in ogni scenario, senza dover costruire
// richieste Express reali con veri validatori collegati.
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

const { validationResult } = require('express-validator');
const validationHandlerMiddleware = require('../middlewares/validationHandlerMiddleware');

describe('validationHandlerMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { validationErrors: [] };

    res = { error: jest.fn() };

    next = jest.fn();

    // Di default, nessun errore da express-validator: i singoli test lo
    // sovrascrivono quando vogliono simulare dei validation error.
    validationResult.mockReturnValue({ array: () => [] });
  });

  it('should call next() when there are no errors at all', () => {
    validationHandlerMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();

    expect(res.error).not.toHaveBeenCalled();
  });

  it('should group express-validator errors by field, one message per field', () => {
    // Caso tipico: due campi obbligatori mancanti in una richiesta di
    // registrazione. Il raggruppamento produce un oggetto { id, message }
    // per ciascun campo distinto.
    validationResult.mockReturnValue({
      array: () => [
        { path: 'email', msg: 'Email è richiesta' },
        { path: 'password', msg: 'Password è richiesta' },
      ],
    });

    validationHandlerMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, [
      { id: 'email', message: 'Email è richiesta' },
      { id: 'password', message: 'Password è richiesta' },
    ]);

    expect(next).not.toHaveBeenCalled();
  });

  it('should only keep the FIRST error message when a field has multiple validator errors', () => {
    // express-validator può produrre più errori per lo stesso campo (es.
    // notEmpty() + isNumeric() entrambi falliti su "price"). Il codice usa
    // `if (!acc[path])`, quindi solo il primo messaggio incontrato per un
    // dato campo sopravvive nel raggruppamento finale.
    validationResult.mockReturnValue({
      array: () => [
        { path: 'price', msg: 'Prezzo del prodotto è richiesto' },
        { path: 'price', msg: 'Prezzo deve essere un numero' },
      ],
    });

    validationHandlerMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, [
      { id: 'price', message: 'Prezzo del prodotto è richiesto' },
    ]);
  });

  it('should group image errors under a single "image" entry, one item per filename', () => {
    // Caso specifico dell'upload multiplo: più file, ognuno con il proprio
    // errore, devono finire in un unico oggetto { id: 'image', message: [...] }
    // con un elemento per file (identificato da filename), non un oggetto
    // { id, message } separato per ciascuno come per gli altri campi.
    req.validationErrors = [
      { path: 'image', msg: 'Formato non valido', filename: 'foto1.png' },
      { path: 'image', msg: 'File troppo grande', filename: 'foto2.png' },
    ];

    validationHandlerMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, [
      {
        id: 'image',
        message: [
          { filename: 'foto1.png', message: 'Formato non valido' },
          { filename: 'foto2.png', message: 'File troppo grande' },
        ],
      },
    ]);
  });

  it('should default the image filename to "_generale_" when none is provided', () => {
    // Caso "immagine mancante": l'errore non riguarda un file specifico
    // (non ce n'è nessuno), quindi il filename convenzionale è '_generale_'.
    req.validationErrors = [
      { path: 'image', msg: "L'immagine del prodotto è richiesta" },
    ];

    validationHandlerMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, [
      {
        id: 'image',
        message: [
          {
            filename: '_generale_',
            message: "L'immagine del prodotto è richiesta",
          },
        ],
      },
    ]);
  });

  it('should not duplicate two image errors that share the same filename', () => {
    req.validationErrors = [
      { path: 'image', msg: 'Primo errore', filename: 'foto.png' },
      { path: 'image', msg: 'Secondo errore stesso file', filename: 'foto.png' },
    ];

    validationHandlerMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, [
      {
        id: 'image',
        message: [{ filename: 'foto.png', message: 'Primo errore' }],
      },
    ]);
  });

  it('should merge express-validator field errors with req.validationErrors image errors', () => {
    validationResult.mockReturnValue({
      array: () => [{ path: 'name', msg: 'Nome del prodotto è richiesto' }],
    });

    req.validationErrors = [
      { path: 'image', msg: "L'immagine del prodotto è richiesta" },
    ];

    validationHandlerMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, [
      { id: 'name', message: 'Nome del prodotto è richiesto' },
      {
        id: 'image',
        message: [
          {
            filename: '_generale_',
            message: "L'immagine del prodotto è richiesta",
          },
        ],
      },
    ]);
  });

  it('should short-circuit to a single error message when a fatal error is present', () => {
    // Un errore "fatale" (es. superamento dell'hard limit Multer, marcato da
    // handleMulterErrorsMiddleware) salta completamente la logica di
    // raggruppamento: la risposta è una stringa singola, non un array,
    // anche se nella lista sono presenti anche altri errori "normali".
    req.validationErrors = [
      { path: 'name', msg: 'Nome del prodotto è richiesto' },
      { msg: 'Operazione non permessa.', isFatal: true },
    ];

    validationHandlerMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(400, 'Operazione non permessa.');

    expect(next).not.toHaveBeenCalled();
  });
});