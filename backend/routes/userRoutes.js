
// Import required modules and middlewares
const express = require('express');
const { body } = require("express-validator");
const router = express.Router();

// Import controllers
//const exampleController = require('../controllers/exampleController');
const authUserController = require("../controllers/user/authUserController");
const profileUserController = require("../controllers/user/profileUserController");

// Import middlewares
const authUserMiddleware = require('../middlewares/authUserMiddleware');
const handleValidationErrors = require('../middlewares/validationHandler');

// Route: Get example (protected route)
// GET /
router.get(
  '/', 
  authUserMiddleware, 
  //exampleController.getExample
  profileUserController.getProfileUser
);

// Route: Update user profile
// PATCH /user
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

// Route: Register a new user
// POST /register
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

// Route: User login
// POST /login
router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email è richiesta'),
    body('password').notEmpty().withMessage('Password è richiesta')
  ],
  handleValidationErrors,
  authUserController.login
);

// Route: User change password
// PATCH /user/password
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

// Export the router
module.exports = router;
