const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authCustomerController = require('../controllers/customer/authCustomerController');
const handleValidationErrors = require('../middlewares/validationHandlerMiddleware');

router.get('/', (req, res) => {
  res.success('𝕴𝖙 𝖂𝖔𝖗𝖐𝖘!');
});

router.post(
  '/register',
  [
    body('email').notEmpty().withMessage('Email è richiesta'),
    body('password').notEmpty().withMessage('Password è richiesta'),
    body('firstName').notEmpty().withMessage('Nome è richiesta'),
    body('lastName').notEmpty().withMessage('Cognome è richiesta'),
    body('address').notEmpty().withMessage('Indirizzo è richiesto'),
  ],
  handleValidationErrors,
  authCustomerController.register
);

router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email è richiesta'),
    body('password').notEmpty().withMessage('Password è richiesta'),
  ],
  handleValidationErrors,
  authCustomerController.login
);

module.exports = router;
