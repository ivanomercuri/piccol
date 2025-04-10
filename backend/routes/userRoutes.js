const express = require('express');
const router = express.Router();
const exampleController = require('../controllers/exampleController');
const authUserMiddleware = require('../middlewares/authUserMiddleware');
const {body} = require("express-validator");
const authUserController = require("../controllers/authUserController");
const handleValidationErrors = require('../middlewares/validationHandler');
const authCustomerController = require("../controllers/authCustomerController");

router.get('/', authUserMiddleware, exampleController.getExample);

router.post('/register', [
  body('name').notEmpty().withMessage('Nome è richiesta'),
  body('email').notEmpty().withMessage('Email è richiesta'),
  body('password').notEmpty().withMessage('Password è richiesta')
], handleValidationErrors, authUserController.register);

router.post('/login', [
  body('email').notEmpty().withMessage('Email è richiesta'),
  body('password').notEmpty().withMessage('Password è richiesta')
], handleValidationErrors, authUserController.login);

module.exports = router;
