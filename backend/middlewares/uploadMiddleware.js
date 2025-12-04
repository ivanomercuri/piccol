const multer = require('multer');

const imageFileFilter = (req, file, cb) => {
  // Questo filtro si occupa del tipo di file.
  if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
    // Aggiungiamo un errore specifico che verrà raccolto più avanti.
    req.validationErrors = req.validationErrors || [];

    req.validationErrors.push({
      msg: `Il file ${file.originalname} non è un'immagine JPG o PNG`,
      filename: file.originalname,
      path: file.fieldname,
    });

    // Diciamo a Multer di non accettare il file, ma il nostro gestore di errori
    // personalizzato lo trasformerà in un errore di validazione.
    return cb(null, false);
  }
  // Se il tipo di file è corretto, procedi.
  cb(null, true);
};

// Impostiamo un limite di sicurezza "hard" per proteggere il server da file enormi.
// Questo limite è più alto del limite di business (3MB).
const hardLimitMB = 10;
const hardLimitBytes = hardLimitMB * 1024 * 1024;

const uploadImage = multer({
  // Usiamo lo storage su disco di default. Multer creerà una cartella temporanea.
  // Questo evita di caricare i file in RAM.
  dest: 'uploads/',
  fileFilter: imageFileFilter,
  limits: {
    fileSize: hardLimitBytes,
  },
});

module.exports = {
  uploadImage,
};
