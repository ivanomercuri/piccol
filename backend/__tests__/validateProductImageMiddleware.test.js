const validateProductImageMiddleware = require('../middlewares/validateProductImageMiddleware');

// Mock dependencies
jest.mock('image-size', () => jest.fn());
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
    });

    it('should add validation error if multer errors exist', () => {
        req.multerFileErrors = [{ msg: 'Multer error', path: 'image' }];
        validateProductImageMiddleware(req, res, next);
        expect(req.validationErrors).toHaveLength(1);
        expect(req.validationErrors[0].msg).toBe('Multer error');
        expect(next).toHaveBeenCalled();
    });

    it('should add validation error if more than 1 image', () => {
        req.files = [
            { fieldname: 'image', buffer: Buffer.from('img1') },
            { fieldname: 'image', buffer: Buffer.from('img2') },
        ];
        validateProductImageMiddleware(req, res, next);
        expect(req.validationErrors).toHaveLength(1);
        expect(req.validationErrors[0].msg).toBe('Devi caricare una sola immagine del prodotto');
        expect(next).toHaveBeenCalled();
    });

    it('should add validation error if no image is present', () => {
        req.files = [];
        validateProductImageMiddleware(req, res, next);
        expect(req.validationErrors).toHaveLength(1);
        expect(req.validationErrors[0].msg).toBe("L'immagine del prodotto è richiesta");
        expect(next).toHaveBeenCalled();
    });

    it('should NOT add required error if other errors exist (e.g. multer error)', () => {
        req.multerFileErrors = [{ msg: 'Invalid type', path: 'image' }];
        req.files = []; // No files because filtered out
        validateProductImageMiddleware(req, res, next);
        expect(req.validationErrors).toHaveLength(1);
        expect(req.validationErrors[0].msg).toBe('Invalid type');
        // Should not have "required" error
        expect(req.validationErrors.some(e => e.msg === "L'immagine del prodotto è richiesta")).toBe(false);
        expect(next).toHaveBeenCalled();
    });

    it('should add validation error if image dimensions are too large', () => {
        req.files = [{ fieldname: 'image', buffer: Buffer.from('large') }];
        sizeOf.mockReturnValue({ width: 2000, height: 1000 }); // Width too large

        validateProductImageMiddleware(req, res, next);
        expect(req.validationErrors).toHaveLength(1);
        expect(req.validationErrors[0].msg).toContain("L'immagine non può superare");
        expect(next).toHaveBeenCalled();
    });

    it('should pass if image is valid', () => {
        req.files = [{ fieldname: 'image', buffer: Buffer.from('valid') }];
        sizeOf.mockReturnValue({ width: 1000, height: 1000 });

        validateProductImageMiddleware(req, res, next);
        expect(req.validationErrors).toHaveLength(0);
        expect(next).toHaveBeenCalled();
    });
});
