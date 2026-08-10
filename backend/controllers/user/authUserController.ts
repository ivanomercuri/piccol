import { Request, Response } from 'express';
// models/index.ts usa `export = db` (un singolo oggetto, non named export):
// l'import va fatto come default import, non con la destructuring
// `import { User } from '../../models'` (che qui non risolve, dato che il
// modulo non ha un named export letterale `User` a livello di tipi, solo
// un indice `Record<string, any>`).
import models from '../../models';
import { authenticate } from '../../services/authService';
import { registerEntity } from '../../services/registerService';

const { User } = models;

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    const token = await registerEntity(User, { name, email, password }, [
      'id',
      'email',
    ]);

    return res.success(token);
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const user = await authenticate(User, email, password);

    if (user.success) {
      return res.success(user.token);
    } else {
      return res.error(401, user.message);
    }
  } catch (error) {
    return res.error(500, (error as Error).message);
  }
};