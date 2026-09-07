// Stesso ragionamento di authUserController.test.ts, ma per il dominio
// Customer: verifica che il controller usi il modello Customer (non User) e
// passi i campi specifici dei clienti (firstName, lastName, address), che
// User non ha.
import { Request, Response } from 'express';

jest.mock('../services/authService', () => ({ authenticateCustomer: jest.fn() }));

jest.mock('../services/registerService', () => ({
  registerCustomer: jest.fn(),
}));

import { authenticateCustomer } from '../services/authService';
import { registerCustomer } from '../services/registerService';
import * as authCustomerController from '../controllers/customer/authCustomerController';

describe('authCustomerController.register', () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = {
      body: {
        email: 'mario@example.com',
        password: 'pw',
        firstName: 'Mario',
        lastName: 'Rossi',
        address: 'Via Roma 1',
      },
    } as unknown as Request;

    res = { success: jest.fn(), error: jest.fn() } as unknown as Response;

    jest.clearAllMocks();
  });

  it('should register the customer against the Customer model with all its fields', async () => {
    (registerCustomer as jest.Mock).mockResolvedValue('a-jwt-token');

    await authCustomerController.register(req, res);

    expect(registerCustomer).toHaveBeenCalledWith(
      {
        email: 'mario@example.com',
        password: 'pw',
        firstName: 'Mario',
        lastName: 'Rossi',
        address: 'Via Roma 1',
      }
    );

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 500 error if registerCustomer throws', async () => {
    (registerCustomer as jest.Mock).mockRejectedValue(
      new Error('Duplicate entry')
    );

    await authCustomerController.register(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'Duplicate entry');
  });
});

describe('authCustomerController.login', () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = {
      body: { email: 'mario@example.com', password: 'pw' },
    } as unknown as Request;

    res = { success: jest.fn(), error: jest.fn() } as unknown as Response;

    jest.clearAllMocks();
  });

  it('should authenticateCustomer against the Customer model and return the token', async () => {
    (authenticateCustomer as jest.Mock).mockResolvedValue({
      success: true,
      token: 'a-jwt-token',
    });

    await authCustomerController.login(req, res);

    expect(authenticateCustomer).toHaveBeenCalledWith(
      'mario@example.com',
      'pw'
    );

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 401 with the service message when authentication fails', async () => {
    (authenticateCustomer as jest.Mock).mockResolvedValue({
      success: false,
      message: 'Utente non trovato',
    });

    await authCustomerController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');
  });

  it('should return a 500 error if authenticateCustomer throws unexpectedly', async () => {
    (authenticateCustomer as jest.Mock).mockRejectedValue(new Error('DB down'));

    await authCustomerController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'DB down');
  });
});