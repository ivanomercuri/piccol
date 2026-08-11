import { Request, Response } from 'express';

export = (req: Request, res: Response) => {
  return res.error(404, 'Non trovato');
};