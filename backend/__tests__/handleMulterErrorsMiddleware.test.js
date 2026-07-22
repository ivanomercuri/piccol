// handleMulterErrorsMiddleware intercetta gli errori sollevati da Multer
// durante l'upload (è un error-handling middleware Express a 4 argomenti,
// registrato subito dopo uploadImage.array('image') in productRoutes.js) e
// li traduce nel pattern di accumulo su req.validationErrors usato in tutto
// il progetto. Prima di questo file non era mai stato testato, nonostante sia
// l'unico punto che marca un errore come "fatale" (isFatal: true).
const multer = require('multer');
const handleMulterErrorsMiddleware = require('../middlewares/handleMulterErrorsMiddleware');

describe('handleMulterErrorsMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};

    res = {};

    next = jest.fn();
  });

  it('should mark LIMIT_FILE_SIZE as a fatal error with a generic message', () => {
    // Il superamento dell'hard limit (10MB, vedi uploadMiddleware.js) viene
    // trattato come un evento "di sicurezza": il messaggio esposto al client
    // è volutamente generico ("Operazione non permessa"), non i dettagli
    // tecnici del limite superato, e viene marcato isFatal per bypassare il
    // normale raggruppamento in validationHandlerMiddleware.
    const err = new multer.MulterError('LIMIT_FILE_SIZE');

    handleMulterErrorsMiddleware(err, req, res, next);

    expect(req.validationErrors).toEqual([
      { msg: 'Operazione non permessa.', isFatal: true },
    ]);

    // Il flusso deve proseguire (verso validationHandlerMiddleware), non
    // deve essere passato come errore a next(err).
    expect(next).toHaveBeenCalledWith();
  });

  it('should mark other MulterError codes as non-fatal, using the original message', () => {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'image');

    handleMulterErrorsMiddleware(err, req, res, next);

    expect(req.validationErrors).toEqual([
      { msg: err.message, isFatal: false },
    ]);

    expect(next).toHaveBeenCalledWith();
  });

  it('should append to an already-populated req.validationErrors instead of overwriting it', () => {
    req.validationErrors = [{ msg: 'Errore precedente', path: 'image' }];

    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');

    handleMulterErrorsMiddleware(err, req, res, next);

    expect(req.validationErrors).toHaveLength(2);

    expect(req.validationErrors[0].msg).toBe('Errore precedente');
  });

  it('should pass non-Multer errors through to the global error handler via next(err)', () => {
    // Un errore che non arriva da Multer (es. un bug generico più a monte)
    // non deve essere interpretato come un problema di upload: va inoltrato
    // così com'è al middleware di errore globale.
    const err = new Error('Errore generico non legato a Multer');

    handleMulterErrorsMiddleware(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);

    expect(req.validationErrors).toBeUndefined();
  });
});