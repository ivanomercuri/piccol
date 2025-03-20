// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {body} = require('express-validator');

const authController = require('../controllers/authController');

// Rotta POST per login
router.post('/login', [
  body('email').notEmpty().withMessage('Email è richiesta'),
  body('password').notEmpty().withMessage('Password è richiesta')
], authController.login);

module.exports = router;
