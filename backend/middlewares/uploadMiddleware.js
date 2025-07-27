const multer = require('multer');

const storage = multer.memoryStorage();
const maxSize = parseInt(process.env.MAX_FILE_SIZE, 10);

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png') {
    req.multerFileErrors = req.multerFileErrors || [];
    req.multerFileErrors.push({
      msg: `Il file ${file.originalname} non è un'immagine JPG o PNG`,
      path: file.fieldname
    });
  }
  cb(null, true);
};

const upload = multer({
  storage
}); // generico
const uploadImage = multer({
  storage,
  fileFilter: imageFileFilter ,
  limits: {
    fileSize: maxSize
  }
}); // con filtro

module.exports = {
  upload,
  uploadImage
};
