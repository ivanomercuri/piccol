const { validationResult } = require('express-validator');

module.exports = (req, res, next) => {
    const errors = validationResult(req).array();
    const extraErrors = req.validationErrors || [];

    // Uniamo tutti gli errori
    let allErrors = [...errors, ...extraErrors];

    const requiredFilesInfo = req.requiredFilesInfo || new Map();
    const presentFiles = req.files || [];

    // Controllo file obbligatori (generico)
    for (const [field, { label, customMessage }] of requiredFilesInfo.entries()) {
        const alreadyHasError = allErrors.some((e) => e.path === field);
        const found = presentFiles.some((f) => f.fieldname === field);

        if (!alreadyHasError && !found) {
            allErrors.push({
                msg: customMessage || `Il file ${label} è richiesto`,
                path: field,
                // Aggiungiamo un filename generico per uniformità se il campo è 'image'
                filename: field === 'image' ? '_generale_' : undefined
            });
        }
    }

    if (allErrors.length > 0) {
        const groupedErrors = allErrors.reduce((acc, error) => {
            // Estraiamo anche 'filename' oltre a path e msg
            const { path, msg, filename } = error;

            // Logica: Se c'è un filename o se stiamo trattando il campo 'image',
            // creiamo un oggetto strutturato. Altrimenti usiamo solo la stringa msg.
            let errorContent = msg;

            if (path === 'image') {
                errorContent = {
                    filename: filename || '_generale_', // '_generale_' se non specificato
                    message: msg
                };
            }

            if (!acc[path]) {
                // Primo errore per questo campo
                acc[path] = { id: path, message: errorContent };
            } else {
                // Se c'è già un errore, trasformiamo 'message' in un array (se non lo è già)
                if (!Array.isArray(acc[path].message)) {
                    acc[path].message = [acc[path].message];
                }
                acc[path].message.push(errorContent);
            }
            return acc;
        }, {});

        // Se per coerenza vuoi che 'image' sia SEMPRE un array anche se ha 1 solo errore
        // (utile per il frontend che cicla sempre), puoi aggiungere questo check:
        if (groupedErrors['image'] && !Array.isArray(groupedErrors['image'].message)) {
            groupedErrors['image'].message = [groupedErrors['image'].message];
        }

        const finalErrors = Object.values(groupedErrors);

        return res.error(400, finalErrors);
    }
    next();
};