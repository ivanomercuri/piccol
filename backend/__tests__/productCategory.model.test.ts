// ProductCategory è la tabella di join: l'unica cosa davvero interessante da
// verificare con un DB reale è l'indice univoco su (product_id, category_id)
// creato esplicitamente dalla migrazione (product_category_unique_idx), che
// impedisce di associare due volte lo stesso prodotto alla stessa categoria.
import models from '../models';

const { ProductCategory, Product, Category, User, sequelize } = models;

describe('ProductCategory model', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let author: any;
  let product: any;
  let category: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  beforeAll(async () => {
    author = await User.create({
      name: 'ProductCategory Model Test Author',
      email: 'productcategory-model-test-author@example.com',
      password: 'pw',
    });

    product = await Product.create({
      name: 'ProductCategory model test product',
      price: 1,
      createdBy: author.id,
    });

    category = await Category.create({
      name: `ProductCategory model test category ${Date.now()}`,
    });
  });

  afterAll(async () => {
    // Cancellare il prodotto rimuove a cascata anche la riga di join.
    await Product.destroy({ where: { id: product.id } });

    await Category.destroy({
      where: { id: category.id },
      force: true,
      paranoid: false,
    });

    await User.destroy({ where: { id: author.id } });

    await sequelize.close();
  });

  it('should create a join row linking a product and a category', async () => {
    const link = await ProductCategory.create({
      product_id: product.id,
      category_id: category.id,
    });

    expect(link.id).toBeDefined();

    await link.destroy();
  });

  it('should reject a duplicate (product_id, category_id) pair via the unique index', async () => {
    const first = await ProductCategory.create({
      product_id: product.id,
      category_id: category.id,
    });

    await expect(
      ProductCategory.create({
        product_id: product.id,
        category_id: category.id,
      })
    ).rejects.toThrow();

    await first.destroy();
  });
});