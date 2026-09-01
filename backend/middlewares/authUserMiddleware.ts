import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import models from '../models';
import { JWT_SECRET } from '../services/tokenService';

const { User } = models;

export = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.error(401, 'Token mancante');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.error(401, 'Formato token non valido');
  }
  try {
    // Cast: jwt.verify() può restituire una stringa semplice (payload
    // stringa, non oggetto) oltre a JwtPayload — qui non è mai stato
    // controllato, si è sempre assunto un payload oggetto con `.id`
    // (coerente con come signToken lo firma in services/tokenService.ts).
    // JWT_SECRET arriva già validato da tokenService (nessun cast qui).
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const user = await User.findOne({ where: { id: decoded.id } });

    if (!user) {
      return res.error(401, 'Utente non trovato');
    }

    if (user.current_token !== token) {
      return res.error(401, 'Token non più valido');
    }

    req.user = user;

    next();
  } catch {
    return res.error(401, 'Token scaduto o non valido');
  }
};