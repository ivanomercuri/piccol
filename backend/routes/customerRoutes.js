const express = require('express');
const {body} = require("express-validator");
const authCustomerController = require("../controllers/authCustomerController");
const handleValidationErrors = require('../middlewares/validationHandler');
const router = express.Router();

router.post('/register', [
  body('email').notEmpty().withMessage('Email è richiesta'),
  body('password').notEmpty().withMessage('Password è richiesta'),
  body('firstName').notEmpty().withMessage('Nome è richiesta'),
  body('lastName').notEmpty().withMessage('Cognome è richiesta'),
  body('address').notEmpty().withMessage('Indirizzo è richiesto'),
], handleValidationErrors, authCustomerController.register);

module.exports = router;