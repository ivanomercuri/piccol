const multer = require('multer');
const storage = multer.memoryStorage();
const maxSize = parseInt(process.env.MAX_FILE_SIZE, 10);
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
    req.multerFileErrors = req.multerFileErrors || [];

    req.multerFileErrors.push({
      msg: `Il file ${file.originalname} non è un'immagine JPG o PNG`,
      filename: file.originalname,
      path: file.fieldname,
    });
  }
  cb(null, true);
};
const upload = multer({
  storage,
});
const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: maxSize * 1024 * 1024,
  },
});

module.exports = {
  upload,
  uploadImage,
};
