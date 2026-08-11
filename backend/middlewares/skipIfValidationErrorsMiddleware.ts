import { Request, Response, NextFunction } from 'express';

// Non risulta montato su nessuna route (verificato) e, anche se lo fosse,
// entrambi i rami chiamano `next()` — la logica non "salta" mai nulla
// nonostante il nome. Pre-esistente, non corretto qui: solo tipizzato.
export = (req: Request, res: Response, next: NextFunction) => {
  if (req.validationErrors) {
    return next();
  }
  next();
};