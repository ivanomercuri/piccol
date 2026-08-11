import models from '../models';

const { Category, sequelize } = models;

describe('Category model', () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    // paranoid: false serve perché uno dei test soft-cancella la riga senza
    // force — senza questa opzione, destroy() bulk ignorerebbe le righe già
    // marcate come cancellate e lascerebbe il nome "occupato" per la
    // prossima esecuzione della suite (violazione dello UNIQUE su name).
    await Category.destroy({
      where: { id: createdIds },
      force: true,
      paranoid: false,
    });

    createdIds.length = 0;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create a category with a unique name', async () => {
    const category = await Category.create({
      name: `Model test category ${Date.now()}`,
    });

    createdIds.push(category.id);

    expect(category.id).toBeDefined();
  });

  it('should reject a duplicate name via the DB unique constraint', async () => {
    const name = `Model test dup category ${Date.now()}`;

    const first = await Category.create({ name });

    createdIds.push(first.id);

    await expect(Category.create({ name })).rejects.toThrow();
  });

  it('should be paranoid: destroy() soft-deletes instead of removing the row', async () => {
    // La migrazione crea anche `deletedAt`: models/category.ts imposta
    // `paranoid: true` proprio per questo. Verifichiamo che il comportamento
    // reale corrisponda a quanto commentato nel modello.
    const category = await Category.create({
      name: `Model test paranoid ${Date.now()}`,
    });

    createdIds.push(category.id);

    await category.destroy();

    // Le query di default (paranoid) escludono i record soft-deleted...
    const foundDefault = await Category.findByPk(category.id);

    expect(foundDefault).toBeNull();

    // ...ma la riga esiste ancora nel DB, recuperabile con paranoid: false.
    const foundWithParanoidOff = await Category.findByPk(category.id, {
      paranoid: false,
    });

    expect(foundWithParanoidOff).not.toBeNull();

    expect(foundWithParanoidOff.deletedAt).not.toBeNull();
  });
});