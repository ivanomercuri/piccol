import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';

export const getProducts = async (req: Request, res: Response) => {
  try {
    let products;

    // `req.user!`: a differenza di profileUserController, questa route non ha
    // mai avuto un controllo esplicito "if (!req.user) return res.error(401,
    // ...)" prima di leggere req.user.level — un'assunzione implicita che la
    // route sia sempre raggiunta dopo authUserMiddleware (vero oggi,
    // verificato in routes/productRoutes.ts, ma non garantito dai tipi).
    // L'asserzione preserva il comportamento originale (nessun controllo
    // aggiunto) invece di modificarlo in silenzio — segnalato, non corretto.
    if (req.user!.level === 'superadmin') {
      products = await prisma.product.findMany();
    } else if (req.user!.level === 'admin') {
      products = await prisma.product.findMany({
        where: { createdBy: req.user!.id },
      });
    } else {
      return res.error(403, 'Non autorizzato');
    }

    return res.success(products);
  } catch (err) {
    return res.error(403, 'Errore server', err as Error);
  }
};

export const createProduct = async (req: Request, res: Response) => {
  return res.success({});
};
