const imgSize = require('image-size');
const sizeOf = typeof imgSize === 'function' ? imgSize : imgSize.imageSize;

module.exports = (req, res, next) => {
    req.validationErrors = req.validationErrors || [];

    // 1. Check Multer Errors (e.g. invalid file type from fileFilter)
    if (req.multerFileErrors && req.multerFileErrors.length > 0) {
        req.validationErrors.push(...req.multerFileErrors);
    }

    const field = 'image';
    const files = (req.files || []).filter((f) => f.fieldname === field);
    const count = files.length;

    // 2. Check Number of Files (Max 1)
    if (count > 1) {
        req.validationErrors.push({
            msg: 'Devi caricare una sola immagine del prodotto',
            path: field,
        });
    }

    // 3. Check Required File
    if (count === 0) {
        // Only add required error if there are no other errors for this field yet?
        // The original logic had separate middlewares.
        // requireFileMiddleware adds error if file not found.
        // Let's stick to the plan: add error if count is 0.
        // However, if we have multer errors (like invalid type), maybe we shouldn't say "required"?
        // But if invalid type, multer filters it out, so count might be 0.
        // If multer filtered it out, we have an error in req.multerFileErrors.
        // So if we have multer errors, we might not want to add "required" error.
        // Let's check if we already have errors.
        const hasErrors = req.validationErrors.length > 0;
        if (!hasErrors) {
            req.validationErrors.push({
                msg: "L'immagine del prodotto è richiesta",
                path: field,
            });
        }
    }

    // 4. Check Dimensions
    const maxWidth = 1920;
    const maxHeight = 1080;

    for (const file of files) {
        try {
            if (!file.buffer || file.buffer.length === 0) {
                throw new Error('File vuoto');
            }
            const dimensions = sizeOf(file.buffer);
            if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
                req.validationErrors.push({
                    msg: `L'immagine non può superare ${maxWidth}x${maxHeight}px`,
                    path: field,
                });
                break;
            }
        } catch (err) {
            let msg = "Impossibile leggere le dimensioni dell'immagine";
            if (err.message.includes('Offset is outside the bounds of the DataView') || err.message === 'File vuoto') {
                msg = "Il file non è un'immagine valida o è corrotto";
            } else {
                msg += ": " + err.message;
            }

            req.validationErrors.push({
                msg: msg,
                path: field,
            });
        }
    }

    next();
};
