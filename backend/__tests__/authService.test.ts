// authService dopo la migrazione a Prisma: non più una funzione generica su
// un modello Sequelize, ma funzioni esplicite per entità che condividono la
// logica di sicurezza tramite completeAuthentication. Dalla fase F2 della
// migrazione a NestJS qui resta solo authenticateUser: il login dei Customer
// e i suoi test sono in modules/customer/ e customerAuthService.test.ts.
//
// Cambia di conseguenza anche il modo di testarle:
// prima si passava un finto "modello" con findOne/getAttributes, ora si
// mocka il client Prisma condiviso.
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { authenticateUser, AuthResult } from '../services/authService';
import { prisma } from '../prisma/client';

// Il client Prisma è un modulo condiviso: mockarlo qui isola completamente
// questi test dal database, come facevano i vecchi mock dei modelli.
jest.mock('../prisma/client', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
};

// AuthResult è un'unione discriminata: `token` esiste solo nella forma con
// success true, e TypeScript non permette di leggerlo senza averlo prima
// verificato. Questa funzione fa la verifica UNA volta per tutti i test: se
// il login non è riuscito il test fallisce qui, con un messaggio chiaro,
// invece di proseguire leggendo un token inesistente.
function tokenOf(result: AuthResult): string {
  if (!result.success) {
    throw new Error(`Atteso un login riuscito, ottenuto: ${result.message}`);
  }

  return result.token;
}

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateUser', () => {
    // Caso base: credenziali corrette -> token emesso e salvato su
    // current_token, che è ciò che permette di invalidarlo al logout.
    it('returns success and token if credentials are correct', async () => {
      const hashed = await bcrypt.hash('password', 10);

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password: hashed,
      });

      const result = await authenticateUser('test@example.com', 'password');

      const token = tokenOf(result);

      // Il token appena firmato deve finire sulla riga dell'utente.
      expect(mockedPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { current_token: token },
      });
    });

    // Utente inesistente: nessun confronto password, nessun token, e
    // soprattutto nessuna scrittura sul database.
    it('fails if user is not found', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authenticateUser('notfound@example.com', 'password');

      expect(result.success).toBe(false);

      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });

    // Password sbagliata: l'utente esiste, ma non deve essere emesso alcun
    // token né sovrascritto il current_token esistente (che altrimenti
    // sloggherebbe la sessione legittima in corso).
    it('fails if password is incorrect', async () => {
      const hashed = await bcrypt.hash('password', 10);

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password: hashed,
      });

      const result = await authenticateUser('test@example.com', 'wrong');

      expect(result.success).toBe(false);

      expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });

    // La query di login deve cercare l'email normalizzata: su PostgreSQL,
    // case-sensitive, cercarla come digitata non troverebbe la riga salvata
    // in minuscolo (vedi services/emailNormalizer.ts).
    it('should look the user up by normalized (lowercase) email', async () => {
      const hashed = await bcrypt.hash('password', 10);

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'mario@example.com',
        password: hashed,
      });

      await authenticateUser('Mario@Example.COM', 'password');

      expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mario@example.com' },
      });
    });

    // La scadenza del token è quella centralizzata in tokenService, comune a
    // login e registrazione: prima della centralizzazione le due divergevano
    // (login senza scadenza), ed è un caso che vale la pena continuare a
    // fissare in un test.
    it('issues a token that expires in 1 hour, same policy as registration', async () => {
      const hashed = await bcrypt.hash('password', 10);

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password: hashed,
      });

      const result = await authenticateUser('test@example.com', 'password');

      const decoded = jwt.decode(tokenOf(result)) as JwtPayload;

      expect(decoded.exp! - decoded.iat!).toBeCloseTo(3600, -1);
    });
  });
});
