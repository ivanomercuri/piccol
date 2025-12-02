const multer = require('multer');
const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  // Questo filtro ora si occupa solo del tipo di file.
  // Il controllo sulla dimensione verrà fatto in un middleware successivo.
  if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
    // Aggiungiamo un errore specifico che verrà raccolto più avanti.
    req.validationErrors = req.validationErrors || [];

    req.validationErrors.push({
      msg: `Il file ${file.originalname} non è un'immagine JPG o PNG`,
      filename: file.originalname,
      path: file.fieldname,
    });
  }
  // Accettiamo comunque il file per permettere al flusso di continuare
  // e raccogliere tutti gli errori in una volta sola.
  cb(null, true);
};

const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  // Rimosso il limite di dimensione da Multer.
  // Sarà gestito nel validateProductImageMiddleware.
});

// Esportiamo solo l'istanza che ci serve.
module.exports = {
  uploadImage,
};
