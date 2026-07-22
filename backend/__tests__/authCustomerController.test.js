// Stesso ragionamento di authUserController.test.js, ma per il dominio
// Customer: verifica che il controller usi il modello Customer (non User) e
// passi i campi specifici dei clienti (firstName, lastName, address), che
// User non ha.
jest.mock('../models', () => ({ Customer: {} }));

jest.mock('../services/authService', () => ({ authenticate: jest.fn() }));

jest.mock('../services/registerService', () => ({
  registerEntity: jest.fn(),
}));

const { Customer } = require('../models');
const { authenticate } = require('../services/authService');
const { registerEntity } = require('../services/registerService');
const authCustomerController = require('../controllers/customer/authCustomerController');

describe('authCustomerController.register', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        email: 'mario@example.com',
        password: 'pw',
        firstName: 'Mario',
        lastName: 'Rossi',
        address: 'Via Roma 1',
      },
    };

    res = { success: jest.fn(), error: jest.fn() };

    jest.clearAllMocks();
  });

  it('should register the customer against the Customer model with all its fields', async () => {
    registerEntity.mockResolvedValue('a-jwt-token');

    await authCustomerController.register(req, res);

    expect(registerEntity).toHaveBeenCalledWith(
      Customer,
      {
        email: 'mario@example.com',
        password: 'pw',
        firstName: 'Mario',
        lastName: 'Rossi',
        address: 'Via Roma 1',
      },
      ['id', 'email']
    );

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 500 error if registerEntity throws', async () => {
    registerEntity.mockRejectedValue(new Error('Duplicate entry'));

    await authCustomerController.register(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'Duplicate entry');
  });
});

describe('authCustomerController.login', () => {
  let req, res;

  beforeEach(() => {
    req = { body: { email: 'mario@example.com', password: 'pw' } };

    res = { success: jest.fn(), error: jest.fn() };

    jest.clearAllMocks();
  });

  it('should authenticate against the Customer model and return the token', async () => {
    authenticate.mockResolvedValue({ success: true, token: 'a-jwt-token' });

    await authCustomerController.login(req, res);

    expect(authenticate).toHaveBeenCalledWith(
      Customer,
      'mario@example.com',
      'pw'
    );

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 401 with the service message when authentication fails', async () => {
    authenticate.mockResolvedValue({
      success: false,
      message: 'Utente non trovato',
    });

    await authCustomerController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');
  });

  it('should return a 500 error if authenticate throws unexpectedly', async () => {
    authenticate.mockRejectedValue(new Error('DB down'));

    await authCustomerController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'DB down');
  });
});