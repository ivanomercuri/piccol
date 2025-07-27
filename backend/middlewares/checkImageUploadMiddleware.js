module.exports = (req, res, next) => {
  req.requireImage = true;

  if (req.multerFileError) {
    // Simula un errore di validazione
    req.validationErrors = req.validationErrors || [];
    req.validationErrors.push({
      msg: req.multerFileError.message,
      path: 'image'
    });
  }

  next();
};
