// authUserController è la parte HTTP del login/registrazione admin: prima
// non era mai stato testato direttamente (solo i services condivisi che
// richiama, authService/registerService, avevano copertura). Mockiamo quei
// services e il modello User: qui vogliamo verificare solo il "cablaggio"
// del controller (con che argomenti chiama i services, come traduce il loro
// risultato in res.success/res.error), non la logica di autenticazione in sé.
jest.mock('../models', () => ({ User: {} }));

jest.mock('../services/authService', () => ({ authenticate: jest.fn() }));

jest.mock('../services/registerService', () => ({
  registerEntity: jest.fn(),
}));

const { User } = require('../models');
const { authenticate } = require('../services/authService');
const { registerEntity } = require('../services/registerService');
const authUserController = require('../controllers/user/authUserController');

describe('authUserController.register', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: { name: 'Mario', email: 'mario@example.com', password: 'pw' },
    };

    res = { success: jest.fn(), error: jest.fn() };

    jest.clearAllMocks();
  });

  it('should register the user against the User model and return the token', async () => {
    registerEntity.mockResolvedValue('a-jwt-token');

    await authUserController.register(req, res);

    // Verifichiamo che venga usato proprio il modello User (non Customer) e
    // che i campi del payload/token siano quelli attesi per questo dominio
    // (name incluso, a differenza di Customer che non ce l'ha).
    expect(registerEntity).toHaveBeenCalledWith(
      User,
      { name: 'Mario', email: 'mario@example.com', password: 'pw' },
      ['id', 'email']
    );

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 500 error if registerEntity throws (e.g. duplicate email)', async () => {
    registerEntity.mockRejectedValue(new Error('Duplicate entry'));

    await authUserController.register(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'Duplicate entry');

    expect(res.success).not.toHaveBeenCalled();
  });
});

describe('authUserController.login', () => {
  let req, res;

  beforeEach(() => {
    req = { body: { email: 'mario@example.com', password: 'pw' } };

    res = { success: jest.fn(), error: jest.fn() };

    jest.clearAllMocks();
  });

  it('should return the token on successful authentication', async () => {
    authenticate.mockResolvedValue({ success: true, token: 'a-jwt-token' });

    await authUserController.login(req, res);

    expect(authenticate).toHaveBeenCalledWith(
      User,
      'mario@example.com',
      'pw'
    );

    expect(res.success).toHaveBeenCalledWith('a-jwt-token');
  });

  it('should return a 401 with the service message when authentication fails', async () => {
    authenticate.mockResolvedValue({
      success: false,
      message: 'Password errata',
    });

    await authUserController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Password errata');

    expect(res.success).not.toHaveBeenCalled();
  });

  it('should return a 500 error if authenticate throws unexpectedly', async () => {
    authenticate.mockRejectedValue(new Error('DB down'));

    await authUserController.login(req, res);

    expect(res.error).toHaveBeenCalledWith(500, 'DB down');
  });
});