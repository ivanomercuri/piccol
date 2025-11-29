const imgSize = require('image-size');
const sizeOf = typeof imgSize === 'function' ? imgSize : imgSize.imageSize;

module.exports = (req, res, next) => {
    // Inizializza l'array
    req.validationErrors = req.validationErrors || [];

    // 1. Check Multer Errors (Errori tipo file non valido intercettati prima)
    if (req.multerFileErrors && req.multerFileErrors.length > 0) {
        // Mappiamo gli errori di multer per assicurarci che abbiano la struttura coerente
        const formattedMulterErrors = req.multerFileErrors.map(err => ({
            ...err,
            filename: err.filename || err.originalname || 'unknown_file' // Tentiamo di recuperare il nome se esiste
        }));
        req.validationErrors.push(...formattedMulterErrors);
    }

    const field = 'image';
    const files = (req.files || []).filter((f) => f.fieldname === field);
    const count = files.length;

    // 3. Check Required File
    if (count === 0) {
        const hasErrors = req.validationErrors.length > 0;
        if (!hasErrors) {
            req.validationErrors.push({
                msg: "L'immagine del prodotto è richiesta",
                path: field,
                filename: null // NULL perché il file non esiste proprio
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
                    filename: file.originalname // QUI inseriamo il nome del file colpevole
                });
                // Non mettiamo il break se vogliamo validare anche altri file,
                // ma visto che ne accetti max 1, il break ha senso se count > 1 è già fallito.
            }
        } catch (err) {

            req.validationErrors.push({
                msg: err.message,
                path: field,
                filename: file.originalname // QUI inseriamo il nome del file corrotto
            });
        }
    }

    next();
};