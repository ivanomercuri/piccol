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
    // Prende il posto della validazione `isEmail: true` che stava sul
    // modello Sequelize Customer: Prisma non ha validatori a livello di
    // modello, e questa è comunque la sede prevista da AGENTS.md per la
    // validazione degli input esterni. Cambia il codice di risposta a
    // vantaggio della coerenza: prima un'email malformata arrivava fino al
    // database e tornava come 500 generico, ora è un 400 con messaggio
    // esplicito come tutti gli altri errori di validazione.
    body('email').isEmail().withMessage('Email non valida'),
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