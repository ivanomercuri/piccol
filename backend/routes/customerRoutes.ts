import express from 'express';
import { body } from 'express-validator';
import * as authCustomerController from '../controllers/customer/authCustomerController';
import handleValidationErrors from '../middlewares/validationHandlerMiddleware';

const router = express.Router();

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

export = router;