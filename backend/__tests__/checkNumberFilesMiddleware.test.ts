// Questo middleware è una factory: checkNumberFilesMiddleware(field, max, customMessage)
// restituisce a sua volta un middleware Express che conta quanti file, tra quelli
// caricati con Multer, appartengono al campo `field` indicato, e se superano `max`
// accoda un errore su req.validationErrors (senza mai bloccare la richiesta con un
// throw: next() viene sempre chiamato, coerentemente con il pattern di accumulo
// errori descritto in CLAUDE.md).
//
// Prima di questo file di test, checkNumberFilesMiddleware non aveva NESSUNA
// copertura, nonostante venga usato per imporre il limite "una sola immagine per
// prodotto" in routes/productRoutes.ts — un bug qui sarebbe passato inosservato.
import { Request, Response, NextFunction } from 'express';
import checkNumberFilesMiddleware from '../middlewares/checkNumberFilesMiddleware';

describe('checkNumberFilesMiddleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    // req.files simula l'array che Multer popola dopo aver parsato una richiesta
    // multipart; lo teniamo vuoto di default e lo valorizziamo nei singoli test.
    req = { files: [] } as unknown as Request;

    // res non viene mai usato direttamente dal middleware (non risponde mai da
    // solo, si limita ad accodare errori e chiamare next), quindi un oggetto
    // vuoto è sufficiente.
    res = {} as unknown as Response;

    // next è uno spy: ci serve solo per verificare che venga sempre invocato,
    // sia in caso di successo che di errore di validazione.
    next = jest.fn();
  });

  it('should add a validation error if more files than the max are uploaded', () => {
    // Caso principale che questo middleware deve coprire: due file sul campo
    // "image" quando il massimo consentito è 1 -> deve accodare esattamente un
    // errore di validazione con il messaggio custom passato alla factory, e non
    // deve MAI lanciare un'eccezione o interrompere la catena di middleware.
    req.files = [
      { fieldname: 'image', originalname: 'img1.jpg' },
      { fieldname: 'image', originalname: 'img2.jpg' },
    ] as unknown as Express.Multer.File[];

    const middleware = checkNumberFilesMiddleware(
      'image',
      1,
      'Devi caricare una sola immagine del prodotto'
    );

    middleware(req, res, next);

    // Un solo errore complessivo: il middleware non deve creare un errore per
    // ogni file "in eccesso", ma un unico messaggio riassuntivo.
    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors![0].msg).toBe(
      'Devi caricare una sola immagine del prodotto'
    );

    // Anche in presenza di un errore di validazione, next() va comunque
    // chiamato: è validationHandlerMiddleware, più avanti nella catena, a
    // decidere se e come rispondere con un errore HTTP.
    expect(next).toHaveBeenCalled();
  });

  it('should use the default message when no custom message is given', () => {
    // Il terzo parametro della factory (customMessage) è opzionale: se non lo
    // passiamo, il middleware deve generare da solo un messaggio di default
    // basato sul valore di `max`, per non lasciare l'utente senza spiegazione.
    req.files = [
      { fieldname: 'image', originalname: 'img1.jpg' },
      { fieldname: 'image', originalname: 'img2.jpg' },
    ] as unknown as Express.Multer.File[];

    const middleware = checkNumberFilesMiddleware('image', 1);

    middleware(req, res, next);

    expect(req.validationErrors![0].msg).toBe('Caricare al massimo 1 file');
  });

  it('should not add a validation error if files are within the max', () => {
    // Caso "felice": un solo file quando il massimo è 1 -> nessun errore
    // accodato, la richiesta prosegue senza intoppi verso il middleware
    // successivo nella catena.
    req.files = [
      { fieldname: 'image', originalname: 'img1.jpg' },
    ] as unknown as Express.Multer.File[];

    const middleware = checkNumberFilesMiddleware('image', 1);

    middleware(req, res, next);

    expect(req.validationErrors).toHaveLength(0);

    expect(next).toHaveBeenCalled();
  });

  it('should ignore files belonging to other fields', () => {
    // Il middleware viene istanziato per un campo specifico (qui "image"):
    // deve contare SOLO i file il cui fieldname corrisponde a quel campo,
    // ignorando file caricati su altri campi del form (qui "other"). Senza
    // questo filtro, un upload multi-campo legittimo verrebbe erroneamente
    // rifiutato.
    req.files = [
      { fieldname: 'image', originalname: 'img1.jpg' },
      { fieldname: 'other', originalname: 'other.jpg' },
    ] as unknown as Express.Multer.File[];

    const middleware = checkNumberFilesMiddleware('image', 1);

    middleware(req, res, next);

    expect(req.validationErrors).toHaveLength(0);

    expect(next).toHaveBeenCalled();
  });
});