const multer = require('multer');
const InvalidImageTypeError = require('../classes/InvalidImageTypeError');

const storage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png' ) {
    req.multerFileError = new InvalidImageTypeError();
  }
  cb(null, true);
};

const upload = multer({ storage }); // generico
const uploadImage = multer({ storage, fileFilter: imageFileFilter }); // con filtro

module.exports = {
  upload,
  uploadImage
};
