const express = require('express');
const { body } = require("express-validator");
const router = express.Router();
const authUserController = require("../controllers/user/authUserController");
const profileUserController = require("../controllers/user/profileUserController");
const authUserMiddleware = require('../middlewares/authUserMiddleware');
const handleValidationErrors = require('../middlewares/validationHandlerMiddleware');
router.get(
  '/', 
  authUserMiddleware, 
  
  profileUserController.getProfileUser
);
router.patch(
  '/',
  authUserMiddleware,
  [
    body('name').notEmpty().withMessage('Nome è richiesto'),
    body('email').notEmpty().withMessage('Email è richiesta')
  ],
  handleValidationErrors,
  profileUserController.updateProfileUser
)
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Nome è richiesto'),
    body('email').notEmpty().withMessage('Email è richiesta'),
    body('password').notEmpty().withMessage('Password è richiesta')
  ],
  handleValidationErrors,
  authUserController.register
);
router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email è richiesta'),
    body('password').notEmpty().withMessage('Password è richiesta')
  ],
  handleValidationErrors,
  authUserController.login
);
router.patch(
  '/password',
  authUserMiddleware,
  [
    body('oldPassword').notEmpty().withMessage('Vecchia password è richiesta'),
    body('newPassword').notEmpty().withMessage('Nuova password è richiesta')
  ],
  handleValidationErrors,
  profileUserController.changePassword
);
router.post(
  '/logout',
  authUserMiddleware,
  profileUserController.logout
);
module.exports = router;
