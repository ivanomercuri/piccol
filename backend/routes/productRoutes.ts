import express from 'express';
import { body } from 'express-validator';
import { uploadImage } from '../middlewares/uploadMiddleware';
import handleValidationErrors from '../middlewares/validationHandlerMiddleware';
import validateProductImageMiddleware from '../middlewares/validateProductImageMiddleware';
import authUserMiddleware from '../middlewares/authUserMiddleware';
import handleMulterErrorsMiddleware from '../middlewares/handleMulterErrorsMiddleware';
import checkNumberFilesMiddleware from '../middlewares/checkNumberFilesMiddleware';
import * as productController from '../controllers/product/productController';

const productRoutes = express.Router();

// Middleware per la gestione e validazione dell'upload dell'immagine
const imageUploadAndValidation = [
  uploadImage.array('image'),
  handleMulterErrorsMiddleware,
  // checkNumberFilesMiddleware è una factory generica già presente nel progetto
  // (middlewares/checkNumberFilesMiddleware.js), ma prima di questa riga non era
  // collegata a NESSUNA route: di conseguenza il limite "una sola immagine per
  // prodotto" non veniva applicato davvero, ed era possibile inviare un numero
  // arbitrario di file nel campo `image` senza ricevere alcun errore.
  // La colleghiamo qui, subito dopo handleMulterErrorsMiddleware (così un errore
  // "fatale" di Multer è già stato intercettato) e prima di
  // validateProductImageMiddleware (che valida dimensione/formato dei singoli
  // file), in modo che il conteggio venga controllato per primo.
  checkNumberFilesMiddleware(
    'image',
    1,
    'Devi caricare una sola immagine del prodotto'
  ),
  validateProductImageMiddleware,
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

export = productRoutes;