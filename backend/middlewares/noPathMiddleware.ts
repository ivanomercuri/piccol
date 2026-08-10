import { Request, Response } from 'express';

module.exports = (req: Request, res: Response) => {
  return res.error(404, 'Non trovato');
};