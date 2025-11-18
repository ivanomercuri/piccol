const express = require('express');
const productRoutes = express.Router();
const { uploadImage } = require('../middlewares/uploadMiddleware');
const { body } = require('express-validator');
const handleValidationErrors = require('../middlewares/validationHandlerMiddleware');
const checkImageUpload = require('../middlewares/checkImageUploadMiddleware');
const authUserMiddleware = require('../middlewares/authUserMiddleware');
const checkNumberFiles = require('../middlewares/checkNumberFilesMiddleware');
const requireFileMiddleware = require('../middlewares/requireFileMiddleware');
const handleMulterErrorsMiddleware = require('../middlewares/handleMulterErrorsMiddleware');
const checkImageDimensions = require('../middlewares/checkImageDimensionsMiddleware');
const skipIfValidationErrors = require('../middlewares/skipIfValidationErrorsMiddleware');
const productController = require('../controllers/product/productController');

// Middleware per la gestione e validazione dell'upload dell'immagine
const imageUploadAndValidation = [
  uploadImage.array('image', 2),
  handleMulterErrorsMiddleware,
  skipIfValidationErrors,
  checkNumberFiles('image', 1, 'Devi caricare una sola immagine del prodotto'),
  skipIfValidationErrors,
  requireFileMiddleware('image', '', "L'immagine del prodotto è richiesta"),
  checkImageDimensions({ field: 'image' }),
  skipIfValidationErrors,
  checkImageUpload,
];

// Middleware per la validazione dei campi del prodotto
const productFieldsValidation = [
  body('name').notEmpty().withMessage('Nome del prodotto è richiesto'),
  body('description')
    .notEmpty()
    .withMessage('Descrizione del prodotto è richiesta'),
  body('price')
    .notEmpty()
    .withMessage('Prezzo del prodotto è richiesto')
    .isNumeric()
    .withMessage('Prezzo deve essere un numero'),
  body('quantity')
    .notEmpty()
    .withMessage('Quantità del prodotto è richiesta')
    .isInt({ gt: 0 })
    .withMessage('Quantità deve essere maggiore di zero'),
  handleValidationErrors,
];

productRoutes.get('/', authUserMiddleware, productController.getProducts);

productRoutes.post(
  '/new',
  authUserMiddleware,
  ...imageUploadAndValidation,
  ...productFieldsValidation,
  productController.createProduct
);

module.exports = productRoutes;
