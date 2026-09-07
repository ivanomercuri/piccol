import { Request, Response } from 'express';
import { authenticateUser } from '../../services/authService';
import { registerUser } from '../../services/registerService';

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    // Non serve più passare il modello né l'elenco dei campi del token: con
    // due funzioni distinte per User e Customer, il service sa già su quale
    // entità sta lavorando (vedi services/registerService.ts).
    const token = await registerUser({ name, email, password });

    return res.success(token);
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await authenticateUser(email, password);

    if (user.success) {
      return res.success(user.token);
    } else {
      return res.error(401, user.message);
    }
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};
