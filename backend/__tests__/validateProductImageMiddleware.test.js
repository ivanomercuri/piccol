// Mock dependencies (dichiarati prima del require del middleware, così
// `unlinkFile = util.promisify(fs.unlink)` cattura già la versione mockata)
jest.mock('image-size', () => jest.fn());

jest.mock('fs', () => ({
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
    req = {
      files: [],
      validationErrors: [],
    };

    res = {};

    next = jest.fn();

    sizeOf.mockReset();

    fs.readFileSync.mockReset().mockReturnValue(Buffer.from('fake'));

    fs.unlink.mockClear();
  });

  it('should skip validation if validation errors already exist and no files were parsed (e.g. a fatal multer error)', () => {
    req.validationErrors = [{ msg: 'Multer error', path: 'image' }];

    delete req.files;

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toBe('Multer error');

    expect(next).toHaveBeenCalled();
  });

  it('should add validation error if no image is present', () => {
    req.files = [];

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toBe(
      "L'immagine del prodotto è richiesta"
    );

    expect(next).toHaveBeenCalled();
  });

  it('should NOT add required error if other errors exist (e.g. file rejected upstream for invalid type)', () => {
    req.validationErrors = [{ msg: 'Invalid type', path: 'image' }];

    req.files = []; // Il file è stato scartato dal filtro mimetype a monte

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toBe('Invalid type');

    // Should not have "required" error
    expect(
      req.validationErrors.some(
        (e) => e.msg === "L'immagine del prodotto è richiesta"
      )
    ).toBe(false);

    expect(next).toHaveBeenCalled();
  });

  it('should add validation error if image dimensions are too large', () => {
    req.files = [
      {
        fieldname: 'image',
        mimetype: 'image/jpeg',
        path: '/tmp/large.jpg',
        originalname: 'large.jpg',
      },
    ];

    sizeOf.mockReturnValue({ width: 2000, height: 1000 }); // Width too large

    validateProductImageMiddleware(req, res, next);

    expect(req.validationErrors).toHaveLength(1);

    expect(req.validationErrors[0].msg).toContain(
      'Le dimensioni non possono superare'
    );

    expect(next).toHaveBeenCalled();
  });

  it('should pass if image is valid', () => {
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
