// backend/controllers/user/profileUserController.test.js
const { getProfileUser, updateProfileUser } = require('../controllers/user/profileUserController');

const res = {
  success: jest.fn(),
  error: jest.fn()
};

describe('Profile User', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns user data if present', () => {
    const req = { user: { id: 1, name: 'Mario', email: 'mario@example.com' } };

    getProfileUser(req, res);

    expect(res.success).toHaveBeenCalledWith({ id: 1, name: 'Mario', email: 'mario@example.com' });
    expect(res.error).not.toHaveBeenCalled();
  });

  it('returns 401 error if user not present', () => {
    const req = {};
    const res = {
      success: jest.fn(),
      error: jest.fn()
    };

    getProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');
    expect(res.success).not.toHaveBeenCalled();
  });

  it('returns success if the profile was updated correctly', async () => {
    const req = {
      user: { id: 1, name: 'Mario', email: 'mario@example.com', save: jest.fn().mockResolvedValue(true)},
      body: { name: 'Luigi', email: 'luigi@example.com' }
    };

    await updateProfileUser(req, res);

    expect(req.user.name).toBe('Luigi');
    expect(req.user.email).toBe('luigi@example.com');
    expect(res.success).toHaveBeenCalledWith({ id: 1, name: 'Luigi', email: 'luigi@example.com' });
    expect(res.error).not.toHaveBeenCalled();
  })

  it('does not update anything if body is empty', async () => {
    const req = {
      user: { id: 1, name: 'Mario', email: 'mario@example.com', save: jest.fn().mockResolvedValue(true) },
      body: {}
    };

    await updateProfileUser(req, res);

    expect(req.user.name).toBe('Mario');
    expect(req.user.email).toBe('mario@example.com');
    expect(res.success).toHaveBeenCalledWith({ id: 1, name: 'Mario', email: 'mario@example.com' });
    expect(res.error).not.toHaveBeenCalled();
  });

  it('updates only the name if only name is present', async () => {
    const req = {
      user: { id: 1, name: 'Mario', email: 'mario@example.com', save: jest.fn().mockResolvedValue(true) },
      body: { name: 'Luigi' }
    };

    await updateProfileUser(req, res);

    expect(req.user.name).toBe('Luigi');
    expect(req.user.email).toBe('mario@example.com');
    expect(res.success).toHaveBeenCalledWith({ id: 1, name: 'Luigi', email: 'mario@example.com' });
    expect(res.error).not.toHaveBeenCalled();
  });

  it('updates only the email if only email is present', async () => {
    const req = {
      user: { id: 1, name: 'Mario', email: 'mario@example.com', save: jest.fn().mockResolvedValue(true) },
      body: { email: 'luigi@example.com' }
    };

    await updateProfileUser(req, res);

    expect(req.user.name).toBe('Mario');
    expect(req.user.email).toBe('luigi@example.com');
    expect(res.success).toHaveBeenCalledWith({ id: 1, name: 'Mario', email: 'luigi@example.com' });
    expect(res.error).not.toHaveBeenCalled();
  });

  it('returns error 500 if user.save throws error', async () => {
    const req = {
      user: { id: 1, name: 'Mario', email: 'mario@example.com', save: jest.fn().mockRejectedValue(new Error('DB error')) },
      body: { name: 'Luigi', email: 'luigi@example.com' }
    };

    await updateProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(500, "Errore durante l'aggiornamento del profilo");
    expect(res.success).not.toHaveBeenCalled();
  });

  it('returns error 401 if user not present on update', async () => {
    const req = {
      user: null,
      body: {name: 'Luigi', email: 'luigi@example.com'}
    }

    await updateProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');
    expect(res.success).not.toHaveBeenCalled();
  });

  it('returns error 500 if an unexpected error occurs', async () => {
    const req = {
      user: { id: 1, name: 'Mario', email: 'mario@example.com', save: jest.fn().mockResolvedValue(true) }
    };
    // Simula un errore quando si accede a req.body
    Object.defineProperty(req, 'body', {
      get() {
        throw new Error('Unexpected error');
      }
    });

    await updateProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(500, "Errore durante l'aggiornamento del profilo");
    expect(res.success).not.toHaveBeenCalled();
  });

  it('returns error 500 if an unexpected error occurs during save', async () => {
    const req = {
      user: {
        id: 1,
        name: 'Mario',
        email: 'mario@example.com',
        save: jest.fn().mockRejectedValue({ message: 'Unknown failure' })
      },
      body: { name: 'Luigi', email: 'luigi@example.com' }
    };

    await updateProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(500, "Errore durante l'aggiornamento del profilo");
    expect(res.success).not.toHaveBeenCalled();
  });

  it('returns error 401 if user not present on getProfileUser', async () => {
    const req = {};

    await getProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');
    expect(res.success).not.toHaveBeenCalled();
  });

});