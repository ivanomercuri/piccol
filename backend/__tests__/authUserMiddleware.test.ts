// authUserMiddleware protegge tutte le route /admin/user e /products: prima
// di questo file non aveva NESSUNA copertura, nonostante sia il punto in cui
// si decide se una richiesta è autenticata o meno. Mockiamo jsonwebtoken e il
// modello User (letti entrambi dal modulo reale) per testare ogni ramo della
// logica senza toccare un JWT_SECRET o un DB veri.
import { Request, Response, NextFunction } from 'express';

jest.mock('jsonwebtoken');

jest.mock('../models', () => ({ User: { findOne: jest.fn() } }));

import jwt from 'jsonwebtoken';
import models from '../models';
import authUserMiddleware from '../middlewares/authUserMiddleware';

const { User } = models;

describe('authUserMiddleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {} } as unknown as Request;

    res = { error: jest.fn() } as unknown as Response;

    next = jest.fn();

    jest.clearAllMocks();
  });

  it('should return 401 if the Authorization header is missing', async () => {
    // Nessun header -> non ha senso nemmeno provare a decodificare un token
    // inesistente, il middleware deve fermarsi subito con un messaggio
    // specifico ("Token mancante"), diverso da un token semplicemente non
    // valido, per aiutare il client a distinguere i due casi.
    await authUserMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(401, 'Token mancante');

    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if the Authorization header has no token after "Bearer"', async () => {
    // Header presente ma malformato (es. solo "Bearer" senza token, oppure
    // una stringa senza spazio): dopo lo split su spazio il secondo elemento
    // è undefined. Errore distinto da "Token mancante" perché qui il client
    // ha provato a inviare qualcosa, solo nel formato sbagliato.
    req.headers.authorization = 'Bearer';

    await authUserMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(401, 'Formato token non valido');

    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if jwt.verify throws (expired or invalid signature)', async () => {
    req.headers.authorization = 'Bearer sometoken';

    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await authUserMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(401, 'Token scaduto o non valido');

    // Con un token non decodificabile non ha senso nemmeno interrogare il
    // DB: verifichiamo che il middleware non ci provi nemmeno.
    expect(User.findOne).not.toHaveBeenCalled();

    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if the decoded user no longer exists in the DB', async () => {
    // Caso realistico: un utente viene cancellato dal DB ma qualcuno ha
    // ancora in mano un JWT firmato prima della cancellazione, valido dal
    // punto di vista crittografico ma ormai "orfano".
    req.headers.authorization = 'Bearer sometoken';

    (jwt.verify as jest.Mock).mockReturnValue({ id: 42 });

    User.findOne.mockResolvedValue(null);

    await authUserMiddleware(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ where: { id: 42 } });

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');

    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if the token does not match current_token (invalidated)', async () => {
    // Questo è il cuore del pattern di invalidazione descritto in CLAUDE.md:
    // un JWT crittograficamente valido ma diverso da current_token (perché
    // l'utente ha fatto logout o cambiato password nel frattempo, oppure
    // perché è stato emesso un token più recente) deve essere rifiutato.
    req.headers.authorization = 'Bearer old-token';

    (jwt.verify as jest.Mock).mockReturnValue({ id: 1 });

    User.findOne.mockResolvedValue({ id: 1, current_token: 'new-token' });

    await authUserMiddleware(req, res, next);

    expect(res.error).toHaveBeenCalledWith(401, 'Token non più valido');

    expect(next).not.toHaveBeenCalled();
  });

  it('should attach req.user and call next() if the token is valid and current', async () => {
    const fakeUser = { id: 1, current_token: 'valid-token', level: 'admin' };

    req.headers.authorization = 'Bearer valid-token';

    (jwt.verify as jest.Mock).mockReturnValue({ id: 1 });

    User.findOne.mockResolvedValue(fakeUser);

    await authUserMiddleware(req, res, next);

    expect(req.user).toBe(fakeUser);

    expect(next).toHaveBeenCalled();

    expect(res.error).not.toHaveBeenCalled();
  });
});