const express = require("express");
const productRoutes = express.Router();
const upload = require('../middlewares/upload');
const { body } = require("express-validator");


const productController = require("../controllers/product/productController");

const authUserMiddleware = require('../middlewares/authUserMiddleware');

productRoutes.get(
  '/',
  authUserMiddleware,
  productController.getProducts
);

productRoutes.post(
  '/new',
  authUserMiddleware,
  upload.single('image'),
  [
    body('name').notEmpty().withMessage('Nome del prodotto è richiesto'),
    body('description').notEmpty().withMessage('Descrizione del prodotto è richiesta'),
    body('price')
      .notEmpty().withMessage('Prezzo del prodotto è richiesto')
      .isNumeric().withMessage('Prezzo deve essere un numero'),
    body('quantity')
      .notEmpty().withMessage('Quantità del prodotto è richiesta')
      .isInt({ gt: 0 }).withMessage('Quantità deve essere maggiore di zero')
  ],
  productController.createProduct
)

module.exports = productRoutes;