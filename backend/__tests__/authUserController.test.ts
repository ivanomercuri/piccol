// authUserController è la parte HTTP del login/registrazione admin: prima
// non era mai stato testato direttamente (solo i services condivisi che
// richiama, authService/registerService, avevano copertura). Mockiamo quei
// services e il modello User: qui vogliamo verificare solo il "cablaggio"
// del controller (con che argomenti chiama i services, come traduce il loro
// risultato in res.success/res.error), non la logica di autenticazione in sé.
import { Request, Response } from 'express';

jest.mock('../services/authService', () => ({ authenticateUser: jest.fn() }));

jest.mock('../services/registerService', () => ({
  registerUser: jest.fn(),
}));

import { authenticateUser } from '../services/authService';
import { registerUser } from '../services/registerService';
import * as authUserController from '../controllers/user/authUserController';

describe('authUserController.register', () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = {
      body: { name: 'Mario', email: 'mario@example.com', password: 'pw' },
    } as unknown as Request;

    res = { success: jest.fn(), error: jest.fn() } as unknown as Response;

    jest.clearAllMocks();
  });

  it('should register the user against the User model and return the token', async () => {
    (registerUser as jest.Mock).mockResolvedValue('a-jwt-token');

    await authUserController.register(req, res);

    // Dopo la migrazione a Prisma il modello non viene più passato: è la
    // funzione stessa (registerUser, non registerCustomer) a determinare il
    // dominio. Resta verificato che i campi inoltrati siano quelli attesi
    // qui — name incluso, a differenza di Customer che non ce l'ha.
    expect(registerUser).toHaveBeenCalledWith({
      name: 'Mario',
      email: 'mario@example.com',
      password: 'pw',
    });

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 500 error if registerUser throws (e.g. duplicate email)', async () => {
    (registerUser as jest.Mock).mockRejectedValue(
      new Error('Duplicate entry')
    );

    await authUserController.register(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'Duplicate entry');

    expect(res.success).not.toHaveBeenCalled();
  });
});

describe('authUserController.login', () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = {
      body: { email: 'mario@example.com', password: 'pw' },
    } as unknown as Request;

    res = { success: jest.fn(), error: jest.fn() } as unknown as Response;

    jest.clearAllMocks();
  });

  it('should return the token on successful authentication', async () => {
    (authenticateUser as jest.Mock).mockResolvedValue({
      success: true,
      token: 'a-jwt-token',
    });

    await authUserController.login(req, res);

    expect(authenticateUser).toHaveBeenCalledWith('mario@example.com', 'pw');

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 401 with the service message when authentication fails', async () => {
    (authenticateUser as jest.Mock).mockResolvedValue({
      success: false,
      message: 'Password errata',
    });

    await authUserController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Password errata');

    expect(res.success).not.toHaveBeenCalled();
  });

  it('should return a 500 error if authenticateUser throws unexpectedly', async () => {
    (authenticateUser as jest.Mock).mockRejectedValue(new Error('DB down'));

    await authUserController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'DB down');
  });
});