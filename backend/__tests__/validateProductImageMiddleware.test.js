// I mock vengono dichiarati PRIMA del require del middleware sotto test.
// Il motivo è sottile: dentro validateProductImageMiddleware.js c'è la riga
// `const unlinkFile = util.promisify(fs.unlink);`, valutata una sola volta al
// caricamento del modulo. util.promisify cattura in quel momento il riferimento
// alla funzione fs.unlink allora esistente. Se noi mockassimo fs.unlink DOPO
// aver già fatto require del middleware, la unlinkFile già creata continuerebbe
// a puntare alla fs.unlink reale (quella originale, non mockata) e i nostri test
// finirebbero per tentare di cancellare file temporanei inesistenti sul
// filesystem vero, con relativi errori ENOENT asincroni stampati in console.
jest.mock('image-size', () => jest.fn());

jest.mock('fs', () => ({
  // Manteniamo il resto del modulo fs reale (es. eventuali costanti) e
  // sovrascriviamo solo le due funzioni che il middleware usa realmente.
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
  unlink: jest.fn((path, cb) => cb(null)),
}));

const fs = require('fs');
const validateProductImageMiddleware = require('../middlewares/validateProductImageMiddleware');
const sizeOf = require('image-size');

describe('validateProductImageMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Stato di partenza "neutro" per ogni test: nessun file caricato, nessun
    // errore di validazione già accumulato dai middleware precedenti nella
    // catena (uploadMiddleware, handleMulterErrorsMiddleware). Ogni test
    // sovrascrive questi campi per simulare lo scenario che vuole verificare.
    req = {
      files: [],
      validationErrors: [],
    };

    res = {};

    next = jest.fn();

    // Reset dei mock tra un test e l'altro, per evitare che il valore di
    // ritorno impostato in un test (es. via mockReturnValue) sopravviva al
    // test successivo e ne falsi il risultato.
    sizeOf.mockReset();

    fs.readFileSync.mockReset().mockReturnValue(Buffer.from('fake'));

    fs.unlink.mockClear();
  });

  it('should skip validation if validation errors already exist and no files were parsed (e.g. a fatal multer error)', () => {
    // Scenario reale: handleMulterErrorsMiddleware ha già intercettato un
    // errore fatale di Multer (es. superamento dell'hard limit di dimensione)
    // e ha accodato un errore su req.validationErrors PRIMA che questo
    // middleware venga eseguito. In quel caso req.files non viene nemmeno
    // valorizzato da Multer (upload interrotto), quindi deve rimanere
    // `undefined`. Il middleware, vedendo errori già presenti e nessun file,
    // deve fermarsi subito (early return) senza aggiungere ulteriori errori
    // (in particolare NON deve aggiungere "immagine richiesta", che sarebbe
    // fuorviante rispetto all'errore reale già presente).
    req.validationErrors = [{ msg: 'Multer error', path: 'image' }];

    delete req.files;

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toBe('Multer error');

    expect(next).toHaveBeenCalled();
  });

  it('should add validation error if no image is present', () => {
    // Caso base di validazione "required": nessun file caricato e nessun
    // errore precedente -> il middleware deve accorgersi che l'immagine,
    // obbligatoria per la creazione di un prodotto, manca del tutto, e
    // accodare il relativo messaggio in italiano (stringa rivolta
    // all'utente finale, come da convenzione del progetto).
    req.files = [];

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toBe(
      "L'immagine del prodotto è richiesta"
    );

    expect(next).toHaveBeenCalled();
  });

  it('should NOT add required error if other errors exist (e.g. file rejected upstream for invalid type)', () => {
    // Scenario più sottile del "no image": il file ESISTEVA nella richiesta,
    // ma è stato scartato a monte dal filtro mimetype di uploadMiddleware.js
    // (che accetta solo image/jpeg e image/png). In quel caso req.files
    // arriva a questo middleware come array VUOTO (non undefined, perché
    // Multer ha comunque processato la richiesta), ma req.validationErrors
    // contiene già l'errore di tipo file non valido. Il middleware deve
    // essere abbastanza intelligente da non aggiungere ANCHE l'errore
    // "immagine richiesta" sopra a quello già presente, altrimenti
    // l'utente vedrebbe due messaggi di errore contraddittori/ridondanti
    // per lo stesso identico problema.
    req.validationErrors = [{ msg: 'Invalid type', path: 'image' }];

    req.files = []; // il file è stato scartato dal filtro mimetype a monte

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toBe('Invalid type');

    // Verifica esplicita che l'errore "richiesta" non sia stato aggiunto,
    // così se in futuro qualcuno reintroduce quel bug il test fallisce con
    // un messaggio chiaro invece di un generico "length mismatch".
    expect(
      req.validationErrors.some(
        (e) => e.msg === "L'immagine del prodotto è richiesta"
      )
    ).toBe(false);

    expect(next).toHaveBeenCalled();
  });

  it('should add validation error if image dimensions are too large', () => {
    // Qui testiamo il controllo delle dimensioni (maxWidth/maxHeight da
    // config/imageConfig.js, attualmente 1920x1080). Il file deve avere un
    // mimetype tra quelli accettati (image/jpeg o image/png), altrimenti il
    // middleware non entrerebbe nemmeno nel ramo che chiama image-size — è
    // esattamente il motivo per cui questo test falliva prima della
    // correzione: il file mockato non aveva `mimetype`, quindi il controllo
    // dimensioni veniva silenziosamente saltato e il test passava (o falliva)
    // per il motivo sbagliato.
    // `path` deve essere presente perché il middleware fa
    // `fs.readFileSync(file.path)` per ottenere il buffer da passare a
    // image-size (fs.readFileSync è mockato sopra, quindi il path non deve
    // esistere davvero sul filesystem).
    req.files = [
      {
        fieldname: 'image',
        mimetype: 'image/jpeg',
        path: '/tmp/large.jpg',
        originalname: 'large.jpg',
      },
    ];

    // image-size è mockato a livello di modulo (jest.mock('image-size', ...))
    // quindi qui possiamo semplicemente dirgli di restituire dimensioni che
    // superano la larghezza massima consentita, senza dover fornire
    // un'immagine JPEG vera.
    sizeOf.mockReturnValue({ width: 2000, height: 1000 }); // larghezza eccessiva

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    // Usiamo toContain perché il messaggio reale include anche i valori
    // numerici di maxWidth/maxHeight interpolati (es. "...1920x1080px"), che
    // non vogliamo hardcodare nel test per non doverlo aggiornare ogni volta
    // che cambia config/imageConfig.js.
    expect(req.validationErrors[0].msg).toContain(
      'Le dimensioni non possono superare'
    );

    expect(next).toHaveBeenCalled();
  });

  it('should pass if image is valid', () => {
    // Caso "tutto ok": mimetype accettato, dimensioni entro i limiti ->
    // nessun errore di validazione deve essere accodato, e la richiesta
    // deve proseguire normalmente verso i middleware successivi (i controlli
    // sui campi testuali del prodotto, poi il controller).
    req.files = [
      {
        fieldname: 'image',
        mimetype: 'image/jpeg',
        path: '/tmp/valid.jpg',
        originalname: 'valid.jpg',
      },
    ];

    sizeOf.mockReturnValue({ width: 1000, height: 1000 });

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(0);

    expect(next).toHaveBeenCalled();
  });
});
