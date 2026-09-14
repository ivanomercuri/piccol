// UserAuthService in isolamento, senza database, con CredentialsService vero.
// Eredita i casi di authService.test.ts, registerService.test.ts,
// authUserController.test.ts e profileUserController.test.ts (cambio password
// e logout), rimossi in F3 insieme al codice legacy degli User.
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CredentialsService } from '../modules/auth/credentials.service';
import { UserAuthService } from '../modules/user/user-auth.service';
import { testJwtModule } from './helpers/testJwtModule';

describe('UserAuthService', () => {
  // Solo il delegate `user`: se il service toccasse la tabella customers,
  // il test esploderebbe (separazione delle identità, CLAUDE.md).
  const fakePrisma = {
    user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  let service: UserAuthService;

  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('password123', 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      imports: [testJwtModule()],
      providers: [
        UserAuthService,
        CredentialsService,
        { provide: PrismaClient, useValue: fakePrisma },
      ],
    }).compile();

    service = moduleRef.get(UserAuthService);
  });

  // Una riga User come la restituirebbe Prisma, con i valori sovrascrivibili.
  function userRow(overrides: Partial<User> = {}): User {
    return {
      id: 1,
      name: 'Mario',
      email: 'mario@example.com',
      password: passwordHash,
      level: 'admin',
      current_token: 'token-corrente',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as User;
  }

  describe('register', () => {
    beforeEach(() => {
      fakePrisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve(userRow({ id: 4, ...data }))
      );
    });

    // Mappatura dei campi, email normalizzata, password mai in chiaro. Il
    // campo `level` non compare: ogni User nasce admin per default di schema.
    it('salva nome, email in minuscolo e password come hash, senza impostare level', async () => {
      await service.register({ name: 'Mario', email: 'Mario@Example.com', password: 'password123' });

      const saved = fakePrisma.user.create.mock.calls[0][0].data;

      expect(Object.keys(saved).sort()).toEqual(['email', 'name', 'password']);

      expect(saved.email).toBe('mario@example.com');

      await expect(bcrypt.compare('password123', saved.password)).resolves.toBe(true);
    });

    // Il token restituito è quello salvato sull'utente appena creato.
    it('restituisce il token e lo salva come current_token del nuovo utente', async () => {
      const token = await service.register({ name: 'M', email: 'm@example.com', password: 'p' });

      expect(fakePrisma.user.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { current_token: token },
      });
    });

    // Un errore del database risale intatto fino al filter, e nessun token
    // viene emesso per un utente che non esiste.
    it('lascia risalire un errore del database, senza emettere token', async () => {
      const failure = new Error('Unique constraint failed on the fields: (`email`)');

      fakePrisma.user.create.mockRejectedValue(failure);

      await expect(
        service.register({ name: 'M', email: 'm@example.com', password: 'p' })
      ).rejects.toBe(failure);

      expect(fakePrisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    // La ricerca avviene con l'email normalizzata: è in quella forma che
    // l'email è salvata.
    it('cerca l\'utente per email normalizzata e salva il token emesso', async () => {
      fakePrisma.user.findUnique.mockResolvedValue(userRow());

      const token = await service.login('Mario@Example.com', 'password123');

      expect(fakePrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'mario@example.com' },
      });

      expect(fakePrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { current_token: token },
      });
    });

    it('lancia "Utente non trovato" se l\'email non esiste', async () => {
      fakePrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('nessuno@example.com', 'x')).rejects.toThrow(
        new UnauthorizedException('Utente non trovato')
      );
    });
  });

  describe('changePassword', () => {
    // Senza la password attuale corretta non si cambia nulla: altrimenti un
    // token rubato basterebbe a prendere il controllo dell'account.
    it('con la vecchia password errata lancia 400 e non tocca il database', async () => {
      await expect(
        service.changePassword(userRow(), 'sbagliata', 'nuovapassword')
      ).rejects.toThrow(new BadRequestException('La vecchia password non corrisponde'));

      expect(fakePrisma.user.update).not.toHaveBeenCalled();
    });

    // Caso base, e documentazione del comportamento conservato: l'update
    // tocca SOLO la password. current_token resta quello di prima, quindi il
    // token già emesso continua a funzionare (decisione aperta di F3). Se la
    // decisione cambierà, questo test andrà aggiornato di proposito.
    it('salva il nuovo hash e non modifica current_token (comportamento legacy)', async () => {
      await service.changePassword(userRow({ id: 2 }), 'password123', 'nuovapassword');

      const { where, data } = fakePrisma.user.update.mock.calls[0][0];

      expect(where).toEqual({ id: 2 });

      expect(Object.keys(data)).toEqual(['password']);

      await expect(bcrypt.compare('nuovapassword', data.password)).resolves.toBe(true);
    });
  });

  describe('logout', () => {
    // Azzerare current_token è ciò che fa rifiutare a JwtUserStrategy ogni
    // token già emesso per questo utente.
    it('imposta current_token a null', async () => {
      await service.logout(6);

      expect(fakePrisma.user.update).toHaveBeenCalledWith({
        where: { id: 6 },
        data: { current_token: null },
      });
    });
  });
});
