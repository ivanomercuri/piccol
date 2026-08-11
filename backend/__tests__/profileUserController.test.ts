import { Request, Response } from 'express';
import {
  getProfileUser,
  updateProfileUser,
} from '../controllers/user/profileUserController';

const res = {
  success: jest.fn(),
  error: jest.fn(),
} as unknown as Response;

describe('getProfileUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns user data if present', () => {
    const req = {
      user: { id: 1, name: 'Mario', email: 'mario@example.com' },
    } as unknown as Request;

    getProfileUser(req, res);

    expect(res.success).toHaveBeenCalledWith({
      id: 1,
      name: 'Mario',
      email: 'mario@example.com',
    });

    expect(res.error).not.toHaveBeenCalled();
  });

  it('returns 401 error if user not present', () => {
    const req = {} as unknown as Request;
    const res = {
      success: jest.fn(),
      error: jest.fn(),
    } as unknown as Response;

    getProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');

    expect(res.success).not.toHaveBeenCalled();
  });

  it('returns success if the profile was updated correctly', async () => {
    const req = {
      user: {
        id: 1,
        name: 'Mario',
        email: 'mario@example.com',
        save: jest.fn().mockResolvedValue(true),
      },
      body: { name: 'Luigi', email: 'luigi@example.com' },
    } as unknown as Request;

    await updateProfileUser(req, res);

    expect(req.user!.name).toBe('Luigi');

    expect(req.user!.email).toBe('luigi@example.com');

    expect(res.success).toHaveBeenCalledWith({
      id: 1,
      name: 'Luigi',
      email: 'luigi@example.com',
    });

    expect(res.error).not.toHaveBeenCalled();
  });

  it('does not update anything if body is empty', async () => {
    const req = {
      user: {
        id: 1,
        name: 'Mario',
        email: 'mario@example.com',
        save: jest.fn().mockResolvedValue(true),
      },
      body: {},
    } as unknown as Request;

    await updateProfileUser(req, res);

    expect(req.user!.name).toBe('Mario');

    expect(req.user!.email).toBe('mario@example.com');

    expect(res.success).toHaveBeenCalledWith({
      id: 1,
      name: 'Mario',
      email: 'mario@example.com',
    });

    expect(res.error).not.toHaveBeenCalled();
  });

  it('updates only the name if only name is present', async () => {
    const req = {
      user: {
        id: 1,
        name: 'Mario',
        email: 'mario@example.com',
        save: jest.fn().mockResolvedValue(true),
      },
      body: { name: 'Luigi' },
    } as unknown as Request;

    await updateProfileUser(req, res);

    expect(req.user!.name).toBe('Luigi');

    expect(req.user!.email).toBe('mario@example.com');

    expect(res.success).toHaveBeenCalledWith({
      id: 1,
      name: 'Luigi',
      email: 'mario@example.com',
    });

    expect(res.error).not.toHaveBeenCalled();
  });

  it('updates only the email if only email is present', async () => {
    const req = {
      user: {
        id: 1,
        name: 'Mario',
        email: 'mario@example.com',
        save: jest.fn().mockResolvedValue(true),
      },
      body: { email: 'luigi@example.com' },
    } as unknown as Request;

    await updateProfileUser(req, res);

    expect(req.user!.name).toBe('Mario');

    expect(req.user!.email).toBe('luigi@example.com');

    expect(res.success).toHaveBeenCalledWith({
      id: 1,
      name: 'Mario',
      email: 'luigi@example.com',
    });

    expect(res.error).not.toHaveBeenCalled();
  });

  it('returns error 500 if user.save throws error', async () => {
    const req = {
      user: {
        id: 1,
        name: 'Mario',
        email: 'mario@example.com',
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      },
      body: { name: 'Luigi', email: 'luigi@example.com' },
    } as unknown as Request;

    await updateProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(
      500,
      "Errore durante l'aggiornamento del profilo"
    );

    expect(res.success).not.toHaveBeenCalled();
  });
});