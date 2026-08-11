import express from 'express';
import { body } from 'express-validator';
import * as authUserController from '../controllers/user/authUserController';
import * as profileUserController from '../controllers/user/profileUserController';
import authUserMiddleware from '../middlewares/authUserMiddleware';
import handleValidationErrors from '../middlewares/validationHandlerMiddleware';

const router = express.Router();

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
    body('email').notEmpty().withMessage('Email è richiesta'),
  ],
  handleValidationErrors,
  profileUserController.updateProfileUser
);

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Nome è richiesto'),
    body('email').notEmpty().withMessage('Email è richiesta'),
    body('password').notEmpty().withMessage('Password è richiesta'),
  ],
  handleValidationErrors,
  authUserController.register
);

router.post(
  '/login',
  [
    body('email').notEmpty().withMessage('Email è richiesta'),
    body('password').notEmpty().withMessage('Password è richiesta'),
  ],
  handleValidationErrors,
  authUserController.login
);

router.patch(
  '/password',
  authUserMiddleware,
  [
    body('oldPassword').notEmpty().withMessage('Vecchia password è richiesta'),
    body('newPassword').notEmpty().withMessage('Nuova password è richiesta'),
  ],
  handleValidationErrors,
  profileUserController.changePassword
);

router.post('/logout', authUserMiddleware, profileUserController.logout);

export = router;