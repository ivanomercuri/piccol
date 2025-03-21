const express = require('express');
const router = express.Router();
const exampleController = require('../controllers/exampleController');
const authUserMiddleware = require('../middlewares/authUserMiddleware');
const {body} = require("express-validator");
const authUserController = require("../controllers/authUserController");
const handleValidationErrors = require('../middlewares/validationHandler');

router.get('/', authUserMiddleware, exampleController.getExample);

router.post('/login', [
  body('email').notEmpty().withMessage('Email è richiesta'),
  body('password').notEmpty().withMessage('Password è richiesta')
], handleValidationErrors, authUserController.login);

module.exports = router;
