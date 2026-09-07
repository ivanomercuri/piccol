// Test che parlano con un DB reale (mydatabase_test) invece di mockare
// tutto: qui vogliamo verificare che i vincoli dichiarati nello schema
// Prisma (unique, NOT NULL, default di `level`/`current_token`) siano
// davvero applicati dal database, cosa che un test con client mockato non
// potrebbe mai fare.
//
// Dopo la migrazione da Sequelize a Prisma cambia solo l'API usata: i
// vincoli verificati sono gli stessi, perché sono quelli reali delle
// tabelle, non del vecchio livello ORM.
import { prisma } from '../prisma/client';

describe('User model', () => {
  // Teniamo traccia degli id creati in ogni test per ripulirli in
  // afterEach: senza questo, rilanciare la suite una seconda volta
  // fallirebbe per violazione dello UNIQUE su email.
  const createdIds: number[] = [];

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });

    createdIds.length = 0;
  });

  afterAll(async () => {
    // Ogni file di test apre una propria connessione (Jest isola il require
    // cache per file): va chiusa esplicitamente o il processo resta appeso.
    await prisma.$disconnect();
  });

  it('should default level to "admin" and current_token to null on creation', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'user-model-test-1@example.com',
        password: 'hashed-password',
      },
    });

    createdIds.push(user.id);

    expect(user.level).toBe('admin');

    expect(user.current_token).toBeNull();
  });

  it('should allow level to be explicitly set to "superadmin"', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Super',
        email: 'user-model-test-2@example.com',
        password: 'hashed-password',
        level: 'superadmin',
      },
    });

    createdIds.push(user.id);

    expect(user.level).toBe('superadmin');
  });

  it('should reject a duplicate email via the DB unique constraint', async () => {
    const first = await prisma.user.create({
      data: {
        name: 'First',
        email: 'user-model-test-dup@example.com',
        password: 'pw',
      },
    });

    createdIds.push(first.id);

    await expect(
      prisma.user.create({
        data: {
          name: 'Second',
          email: 'user-model-test-dup@example.com',
          password: 'pw',
        },
      })
    ).rejects.toThrow();
  });

  it('should require name, email and password (NOT NULL)', async () => {
    // Il cast è necessario perché con Prisma questo caso è ora anche un
    // errore di COMPILAZIONE: `data: {}` non soddisfa il tipo generato, che
    // richiede i campi obbligatori. Il test resta comunque utile come
    // difesa in profondità: verifica che, anche aggirando i tipi (per
    // esempio con dati che arrivano da una richiesta HTTP e non sono stati
    // validati), sia il database a rifiutare la riga.
    await expect(
      prisma.user.create({ data: {} as never })
    ).rejects.toThrow();
  });
});
