// Con Sequelize questi test verificavano che il controller mutasse
// l'istanza req.user (req.user.name = ...) prima di chiamare save(). Le
// righe lette da Prisma sono oggetti semplici e il controller non le muta
// più: aggiorna il database con un update esplicito. I test verificano
// quindi COSA arriva davvero al database, che è l'intento originale e in
// più è una verifica più precisa — prima si controllava uno stato
// intermedio in memoria, ora l'effetto reale.
import { Request, Response } from 'express';
import {
  getProfileUser,
  updateProfileUser,
} from '../controllers/user/profileUserController';
import { prisma } from '../prisma/client';

jest.mock('../prisma/client', () => ({
  prisma: { user: { update: jest.fn() } },
}));

const mockedPrisma = prisma as unknown as {
  user: { update: jest.Mock };
};

const res = {
  success: jest.fn(),
  error: jest.fn(),
} as unknown as Response;

function requestFor(body: Record<string, unknown>): Request {
  return {
    user: { id: 1, name: 'Mario', email: 'mario@example.com' },
    body,
  } as unknown as Request;
}

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

    getProfileUser(req, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');

    expect(res.success).not.toHaveBeenCalled();
  });
});

describe('updateProfileUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates both fields and returns the updated profile', async () => {
    mockedPrisma.user.update.mockResolvedValue({
      id: 1,
      name: 'Luigi',
      email: 'luigi@example.com',
    });

    await updateProfileUser(
      requestFor({ name: 'Luigi', email: 'luigi@example.com' }),
      res
    );

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Luigi', email: 'luigi@example.com' },
    });

    // La risposta riflette la riga aggiornata restituita dal database, non
    // l'oggetto in memoria.
    expect(res.success).toHaveBeenCalledWith({
      id: 1,
      name: 'Luigi',
      email: 'luigi@example.com',
    });

    expect(res.error).not.toHaveBeenCalled();
  });

  // Body vuoto: l'update viene comunque eseguito, ma senza campi — quindi
  // non tocca nulla. È il modo in cui si conserva il comportamento
  // precedente (i campi non inviati restano invariati invece di essere
  // azzerati).
  it('does not change any field if body is empty', async () => {
    mockedPrisma.user.update.mockResolvedValue({
      id: 1,
      name: 'Mario',
      email: 'mario@example.com',
    });

    await updateProfileUser(requestFor({}), res);

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {},
    });

    expect(res.error).not.toHaveBeenCalled();
  });

  it('updates only the name if only name is present', async () => {
    mockedPrisma.user.update.mockResolvedValue({
      id: 1,
      name: 'Luigi',
      email: 'mario@example.com',
    });

    await updateProfileUser(requestFor({ name: 'Luigi' }), res);

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Luigi' },
    });
  });

  it('updates only the email if only email is present', async () => {
    mockedPrisma.user.update.mockResolvedValue({
      id: 1,
      name: 'Mario',
      email: 'luigi@example.com',
    });

    await updateProfileUser(requestFor({ email: 'luigi@example.com' }), res);

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { email: 'luigi@example.com' },
    });
  });

  // L'email aggiornata deve essere normalizzata come in registrazione:
  // questo è il terzo punto di scrittura dell'email, fuori dai service
  // condivisi, ed è quello in cui è più facile dimenticarsene.
  it('normalizes the email to lowercase before saving it', async () => {
    mockedPrisma.user.update.mockResolvedValue({
      id: 1,
      name: 'Mario',
      email: 'luigi@example.com',
    });

    await updateProfileUser(requestFor({ email: 'Luigi@Example.COM' }), res);

    expect(mockedPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { email: 'luigi@example.com' },
    });
  });

  it('returns error 500 if the update fails', async () => {
    mockedPrisma.user.update.mockRejectedValue(new Error('DB error'));

    await updateProfileUser(requestFor({ name: 'Luigi' }), res);

    expect(res.error).toHaveBeenCalledWith(
      500,
      "Errore durante l'aggiornamento del profilo"
    );

    expect(res.success).not.toHaveBeenCalled();
  });

  it('returns 401 if user is not present', async () => {
    await updateProfileUser({ body: {} } as unknown as Request, res);

    expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');

    expect(mockedPrisma.user.update).not.toHaveBeenCalled();
  });
});
