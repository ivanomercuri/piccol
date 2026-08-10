import { Request, Response } from 'express';
import models from '../../models';
import { authenticate } from '../../services/authService';
import { registerEntity } from '../../services/registerService';

const { Customer } = models;

export const register = async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, address } = req.body;

  try {
    const token = await registerEntity(
      Customer,
      { email, password, firstName, lastName, address },
      ['id', 'email']
    );

    return res.success(token);
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await authenticate(Customer, email, password);

    if (user.success) {
      return res.success(user.token);
    } else {
      return res.error(401, user.message);
    }
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};