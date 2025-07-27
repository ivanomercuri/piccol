const sizeOf = require('image-size');

module.exports = function checkImageDimensions({ field = 'image', maxWidth = 1920, maxHeight = 1080 }) {
  return (req, res, next) => {
    req.validationErrors = req.validationErrors || [];

    const files = (req.files || []).filter(f => f.fieldname === field);

    for (const file of files) {
      try {
        const dimensions = sizeOf(file.buffer);
        if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
          req.validationErrors.push({
            msg: `L'immagine non può superare ${maxWidth}x${maxHeight}px`,
            path: field
          });
          break;
        }
      } catch (err) {
        req.validationErrors.push({
          msg: 'Impossibile leggere le dimensioni dell\'immagine',
          path: field
        });
      }
    }

    next();
  };
};
