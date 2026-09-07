// Verifica i vincoli della tabella categories contro un DB reale.
//
// CAMBIO DI COMPORTAMENTO nella migrazione a Prisma: con Sequelize il
// modello era `paranoid: true`, quindi destroy() valorizzava deletedAt e le
// query escludevano da sole le righe cancellate. Prisma non ha un
// equivalente nativo e si è deciso (vedi Design Decisions Log in AGENTS.md)
// di non introdurre infrastruttura di soft-delete finché non esiste una
// funzionalità che cancella davvero — oggi nessun controller o service
// cancella categorie. Il test qui sotto è stato quindi riscritto per
// fissare il comportamento REALE di adesso — delete() è fisico — invece di
// continuare a verificare una funzionalità che non esiste più: serve
// proprio a impedire che qualcuno dia per scontato il vecchio soft-delete.
import { prisma } from '../prisma/client';

describe('Category model', () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    await prisma.category.deleteMany({ where: { id: { in: createdIds } } });

    createdIds.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a category with a unique name', async () => {
    const category = await prisma.category.create({
      data: { name: `Model test category ${Date.now()}` },
    });

    createdIds.push(category.id);

    expect(category.id).toBeDefined();

    // La colonna esiste ancora nello schema, ma nessuno la valorizza.
    expect(category.deletedAt).toBeNull();
  });

  it('should reject a duplicate name via the DB unique constraint', async () => {
    const name = `Model test dup ${Date.now()}`;

    const first = await prisma.category.create({ data: { name } });

    createdIds.push(first.id);

    await expect(prisma.category.create({ data: { name } })).rejects.toThrow();
  });

  it('should delete rows physically: deletedAt is not managed anymore', async () => {
    const category = await prisma.category.create({
      data: { name: `Model test delete ${Date.now()}` },
    });

    await prisma.category.delete({ where: { id: category.id } });

    // Con il vecchio paranoid: true la riga sarebbe ancora qui, con
    // deletedAt valorizzato. Ora sparisce davvero.
    const found = await prisma.category.findUnique({
      where: { id: category.id },
    });

    expect(found).toBeNull();
  });
});
