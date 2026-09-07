import { Request, Response } from 'express';
import { authenticateCustomer } from '../../services/authService';
import { registerCustomer } from '../../services/registerService';

export const register = async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, address } = req.body;

  try {
    const token = await registerCustomer({
      email,
      password,
      firstName,
      lastName,
      address,
    });

    return res.success(token);
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await authenticateCustomer(email, password);

    if (user.success) {
      return res.success(user.token);
    } else {
      return res.error(401, user.message);
    }
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};
