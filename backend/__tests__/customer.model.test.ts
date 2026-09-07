// Verifica i vincoli reali della tabella customers contro un DB vero.
//
// Nota sulla migrazione a Prisma: qui esisteva anche un test sulla
// validazione di FORMATO dell'email (`isEmail`), che era dichiarata sul
// modello Sequelize. Prisma non ha validatori a livello di modello, quindi
// quella regola si è spostata nella catena di express-validator della route
// di registrazione — ed è lì che ora viene testata
// (customerRoutes.test.ts), non più qui: il database, da solo, accetta
// qualunque stringa purché rispetti unicità e NOT NULL.
import { prisma } from '../prisma/client';

describe('Customer model', () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    await prisma.customer.deleteMany({ where: { id: { in: createdIds } } });

    createdIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a customer with all required fields, address optional', async () => {
    const customer = await prisma.customer.create({
      data: {
        email: 'customer-model-test-1@example.com',
        password: 'pw',
        firstName: 'Mario',
        lastName: 'Rossi',
      },
    });

    createdIds.push(customer.id);

    // A differenza di Sequelize, che restituiva `undefined` per i campi
    // senza defaultValue finché non si ricaricava la riga, Prisma
    // restituisce sempre la riga come è stata realmente scritta: niente
    // reload() necessario.
    expect(customer.current_token).toBeNull();

    expect(customer.address).toBeNull();
  });

  it('should reject a duplicate email via the DB unique constraint', async () => {
    const first = await prisma.customer.create({
      data: {
        email: 'customer-model-test-dup@example.com',
        password: 'pw',
        firstName: 'A',
        lastName: 'B',
      },
    });

    createdIds.push(first.id);

    await expect(
      prisma.customer.create({
        data: {
          email: 'customer-model-test-dup@example.com',
          password: 'pw',
          firstName: 'C',
          lastName: 'D',
        },
      })
    ).rejects.toThrow();
  });

  it('should require firstName, lastName, email and password (NOT NULL)', async () => {
    // Come in user.model.test.ts: il cast serve perché ora il caso è anche
    // un errore di compilazione, ma il test verifica che sia comunque il
    // database a rifiutare la riga se i tipi vengono aggirati.
    await expect(
      prisma.customer.create({ data: {} as never })
    ).rejects.toThrow();
  });
});
