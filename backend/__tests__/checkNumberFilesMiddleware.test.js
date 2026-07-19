// checkNumberFilesMiddleware had no test coverage before this file was added,
// even though it's a factory used to cap uploads per field (e.g. 1 image per product).
const checkNumberFilesMiddleware = require('../middlewares/checkNumberFilesMiddleware');

describe('checkNumberFilesMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { files: [] };

    res = {};

    next = jest.fn();
  });

  it('should add a validation error if more files than the max are uploaded', () => {
    req.files = [
      { fieldname: 'image', originalname: 'img1.jpg' },
      { fieldname: 'image', originalname: 'img2.jpg' },
    ];

    const middleware = checkNumberFilesMiddleware(
      'image',
      1,
      'Devi caricare una sola immagine del prodotto'
    );

    middleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toBe(
      'Devi caricare una sola immagine del prodotto'
    );

    expect(next).toHaveBeenCalled();
  });

  it('should use the default message when no custom message is given', () => {
    req.files = [
      { fieldname: 'image', originalname: 'img1.jpg' },
      { fieldname: 'image', originalname: 'img2.jpg' },
    ];

    const middleware = checkNumberFilesMiddleware('image', 1);

    middleware(req, res, next);

    expect(req.validationErrors[0].msg).toBe('Caricare al massimo 1 file');
  });

  it('should not add a validation error if files are within the max', () => {
    req.files = [{ fieldname: 'image', originalname: 'img1.jpg' }];

    const middleware = checkNumberFilesMiddleware('image', 1);

    middleware(req, res, next);

    expect(req.validationErrors).toHaveLength(0);

    expect(next).toHaveBeenCalled();
  });

  it('should ignore files belonging to other fields', () => {
    req.files = [
      { fieldname: 'image', originalname: 'img1.jpg' },
      { fieldname: 'other', originalname: 'other.jpg' },
    ];

    const middleware = checkNumberFilesMiddleware('image', 1);

    middleware(req, res, next);

    expect(req.validationErrors).toHaveLength(0);

    expect(next).toHaveBeenCalled();
  });
});
