// Come authService.test.ts: dopo la migrazione a Prisma la registrazione non
// è più una funzione generica su un modello Sequelize, ma due funzioni
// esplicite che condividono l'emissione del token. I mock passano quindi dal
// finto "modello" al client Prisma condiviso.
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  registerUser,
  registerCustomer,
} from '../services/registerService';
import { prisma } from '../prisma/client';

jest.mock('../prisma/client', () => ({
  prisma: {
    user: { create: jest.fn(), update: jest.fn() },
    customer: { create: jest.fn(), update: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { create: jest.Mock; update: jest.Mock };
  customer: { create: jest.Mock; update: jest.Mock };
};

describe('registerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    // Caso base: la riga viene creata e il token restituito viene anche
    // salvato su current_token.
    it('registers a new user and returns a token', async () => {
      mockedPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      const token = await registerUser({
        name: 'Test',
        email: 'test@example.com',
        password: 'password',
      });

      expect(typeof token).toBe('string');

      expect(mockedPrisma.user.create).toHaveBeenCalled();

      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { current_token: token },
      });
    });

    // La password non deve MAI finire in chiaro nel database: il test legge
    // ciò che è stato realmente passato a create e verifica che sia un hash
    // valido, non la stringa originale.
    it('hashes the password before storing it', async () => {
      mockedPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      await registerUser({
        name: 'Test',
        email: 'test@example.com',
        password: 'password',
      });

      const created = mockedPrisma.user.create.mock.calls[0][0].data;

      expect(created.password).not.toBe('password');

      expect(await bcrypt.compare('password', created.password)).toBe(true);
    });

    // Contraltare in scrittura della normalizzazione verificata in
    // authService.test.ts: se la registrazione salvasse l'email così come
    // digitata, su PostgreSQL il vincolo UNIQUE non impedirebbe due account
    // per la stessa identità e il login normalizzato non troverebbe la riga.
    it('should persist the email normalized to lowercase', async () => {
      mockedPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'mario@example.com',
      });

      await registerUser({
        name: 'Test',
        email: 'Mario@Example.COM',
        password: 'password',
      });

      const created = mockedPrisma.user.create.mock.calls[0][0].data;

      expect(created.email).toBe('mario@example.com');

      // Gli altri campi restano intatti: la normalizzazione riguarda solo
      // l'email, non è un lowercase applicato a tutto l'input.
      expect(created.name).toBe('Test');
    });

    // Stessa policy di scadenza del login: entrambi passano da signToken.
    it('issues a token that expires in 1 hour, same policy as authentication', async () => {
      mockedPrisma.user.create.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
      });

      const token = await registerUser({
        name: 'Test',
        email: 'test@example.com',
        password: 'password',
      });

      const decoded = jwt.decode(token) as JwtPayload;

      expect(decoded.exp! - decoded.iat!).toBeCloseTo(3600, -1);
    });
  });

  describe('registerCustomer', () => {
    // Customer ha campi propri (firstName/lastName/address) che User non ha:
    // con due funzioni distinte questi campi sono ora tipizzati esplicitamente
    // invece di passare da un oggetto generico.
    it('registers a customer with its own fields, on the customer table', async () => {
      mockedPrisma.customer.create.mockResolvedValue({
        id: 5,
        email: 'cliente@example.com',
      });

      const token = await registerCustomer({
        email: 'Cliente@Example.com',
        password: 'password',
        firstName: 'Mario',
        lastName: 'Rossi',
        address: 'Via Roma 1',
      });

      const created = mockedPrisma.customer.create.mock.calls[0][0].data;

      expect(created.email).toBe('cliente@example.com');

      expect(created.firstName).toBe('Mario');

      expect(created.address).toBe('Via Roma 1');

      expect(typeof token).toBe('string');

      // La registrazione di un customer non deve toccare la tabella users.
      expect(mockedPrisma.user.create).not.toHaveBeenCalled();
    });

    // address è l'unico campo opzionale: se non arriva, deve diventare null
    // esplicito e non undefined, che Prisma interpreterebbe come "campo non
    // fornito".
    it('stores a missing address as null', async () => {
      mockedPrisma.customer.create.mockResolvedValue({
        id: 6,
        email: 'senza@example.com',
      });

      await registerCustomer({
        email: 'senza@example.com',
        password: 'password',
        firstName: 'Mario',
        lastName: 'Rossi',
      });

      const created = mockedPrisma.customer.create.mock.calls[0][0].data;

      expect(created.address).toBeNull();
    });
  });
});
