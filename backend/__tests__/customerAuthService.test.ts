// CustomerAuthService in isolamento, senza database.
//
// Eredita i casi dei test Customer che stavano in authService.test.ts,
// registerService.test.ts e authCustomerController.test.ts, rimossi in F2
// insieme alle funzioni e al controller legacy.
//
// È il primo test del progetto che sostituisce Prisma TRAMITE IL CONTAINER
// invece che con jest.mock sul percorso di un file: il service chiede un
// PrismaClient nel costruttore, e qui la stessa chiave consegna un oggetto
// finto. Il codice del service non sa di essere in un test.
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { CustomerAuthService } from '../modules/customer/customer-auth.service';

describe('CustomerAuthService', () => {
  // Il finto Prisma ha SOLO il delegate `customer`. Se il service toccasse la
  // tabella users, `prisma.user` sarebbe undefined e il test esploderebbe:
  // la separazione fra le due identità (CLAUDE.md) è verificata dalla forma
  // stessa dell'oggetto, senza bisogno di un'asserzione dedicata.
  const fakePrisma = {
    customer: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: CustomerAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Si usa il TestingModule e non `new CustomerAuthService(fakePrisma)`
    // per verificare anche il collegamento: che NestJS sappia risolvere il
    // costruttore del service tramite la chiave PrismaClient. Con `new` il
    // test passerebbe anche se quel collegamento fosse rotto.
    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomerAuthService,
        // Stessa chiave del provider reale (PrismaModule), valore diverso.
        // `useValue` perché l'oggetto finto esiste già: il container non
        // deve costruire nulla, solo consegnarlo.
        { provide: PrismaClient, useValue: fakePrisma },
      ],
    }).compile();

    service = moduleRef.get(CustomerAuthService);
  });

  describe('register', () => {
    const input = {
      email: 'Cliente@Example.com',
      password: 'password123',
      firstName: 'Mario',
      lastName: 'Rossi',
      address: 'Via Roma 1',
    };

    // Il create restituisce ciò che restituirebbe Prisma: la riga con l'id
    // generato dal database.
    beforeEach(() => {
      fakePrisma.customer.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 5, ...data })
      );
    });

    // Mappatura dei campi e normalizzazione dell'email: se l'email venisse
    // salvata con le maiuscole, su PostgreSQL "Cliente@Example.com" e
    // "cliente@example.com" diventerebbero due account distinti.
    it('salva il cliente con i suoi campi e l\'email in minuscolo', async () => {
      await service.register(input);

      const saved = fakePrisma.customer.create.mock.calls[0][0].data;

      expect(saved).toEqual(
        expect.objectContaining({
          email: 'cliente@example.com',
          firstName: 'Mario',
          lastName: 'Rossi',
          address: 'Via Roma 1',
        })
      );
    });

    // La password non deve MAI arrivare in chiaro al database, ma deve essere
    // un hash bcrypt che corrisponde a quella scelta dal cliente.
    it('salva la password come hash bcrypt, mai in chiaro', async () => {
      await service.register(input);

      const saved = fakePrisma.customer.create.mock.calls[0][0].data;

      expect(saved.password).not.toBe('password123');

      await expect(bcrypt.compare('password123', saved.password)).resolves.toBe(true);
    });

    // Il token restituito deve essere anche quello salvato come
    // current_token del cliente appena creato: è ciò che permetterà di
    // invalidarlo (pattern di invalidazione in CLAUDE.md).
    it('restituisce un JWT e lo salva come current_token del nuovo cliente', async () => {
      const token = await service.register(input);

      expect(fakePrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { current_token: token },
      });

      const payload = jwt.decode(token) as JwtPayload;

      expect(payload).toEqual(
        expect.objectContaining({ id: 5, email: 'cliente@example.com' })
      );
    });

    // Un errore del database (es. email già registrata) non va inghiottito
    // né tradotto qui: deve risalire fino ad AllExceptionsFilter. E non si
    // deve tentare di salvare un token per un cliente che non esiste.
    it('lascia risalire un errore del database, senza emettere token', async () => {
      const uniqueViolation = new Error('Unique constraint failed on the fields: (`email`)');

      fakePrisma.customer.create.mockRejectedValue(uniqueViolation);

      await expect(service.register(input)).rejects.toBe(uniqueViolation);

      expect(fakePrisma.customer.update).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    let storedHash: string;

    beforeAll(async () => {
      storedHash = await bcrypt.hash('password123', 10);
    });

    // Caso base: credenziali corrette, token restituito e salvato sul cliente.
    // La ricerca avviene con l'email normalizzata, perché è in quella forma
    // che l'email viene salvata.
    it('con credenziali corrette restituisce il token e lo salva sul cliente', async () => {
      fakePrisma.customer.findUnique.mockResolvedValue({
        id: 7,
        email: 'cliente@example.com',
        password: storedHash,
      });

      const token = await service.login('Cliente@Example.com', 'password123');

      expect(fakePrisma.customer.findUnique).toHaveBeenCalledWith({
        where: { email: 'cliente@example.com' },
      });

      expect(fakePrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { current_token: token },
      });
    });

    // Email sconosciuta: 401 con lo stesso messaggio della versione legacy,
    // e nessuna scrittura sul database.
    it('lancia UnauthorizedException "Utente non trovato" se l\'email non esiste', async () => {
      fakePrisma.customer.findUnique.mockResolvedValue(null);

      await expect(service.login('nessuno@example.com', 'x')).rejects.toThrow(
        new UnauthorizedException('Utente non trovato')
      );

      expect(fakePrisma.customer.update).not.toHaveBeenCalled();
    });

    // Password errata: 401, e soprattutto NESSUN token salvato. Se venisse
    // salvato, un tentativo fallito invaliderebbe la sessione valida del
    // cliente legittimo — un modo per chiunque di sloggarlo conoscendone
    // solo l'email.
    it('lancia UnauthorizedException "Password errata" e non salva nessun token', async () => {
      fakePrisma.customer.findUnique.mockResolvedValue({
        id: 7,
        email: 'cliente@example.com',
        password: storedHash,
      });

      await expect(service.login('cliente@example.com', 'sbagliata')).rejects.toThrow(
        new UnauthorizedException('Password errata')
      );

      expect(fakePrisma.customer.update).not.toHaveBeenCalled();
    });
  });
});
