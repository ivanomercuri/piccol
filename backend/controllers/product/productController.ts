import { Request, Response } from 'express';
import models from '../../models';

const { Product } = models;

export const getProducts = async (req: Request, res: Response) => {
  try {
    let products;

    // `req.user!`: a differenza di profileUserController.js/productController
    // stesso più sotto, questa route non ha mai avuto un controllo esplicito
    // "if (!req.user) return res.error(401, ...)" prima di leggere
    // req.user.level — un'assunzione implicita che la route sia sempre
    // raggiunta dopo authUserMiddleware (vero oggi, verificato in
    // routes/productRoutes.js, ma non garantito dai tipi). L'asserzione
    // preserva il comportamento originale (nessun controllo) invece di
    // aggiungerne uno nuovo in silenzio — segnalato, non corretto qui.
    if (req.user!.level === 'superadmin') {
      products = await Product.findAll();
    } else if (req.user!.level === 'admin') {
      products = await Product.findAll({
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