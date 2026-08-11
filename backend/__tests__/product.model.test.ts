// Product è il modello più connesso di tutti (creator, images, categories):
// qui verifichiamo sia i vincoli propri (default, FK su createdBy, unique su
// sku — il campo aggiunto in questa sessione) sia le associazioni aggiunte
// insieme ai modelli Category/ProductImage/ProductCategory, che prima non
// esistevano.
import models from '../models';

const { Product, User, ProductImage, Category, sequelize } = models;

describe('Product model', () => {
  // createdBy ha un vincolo di FK reale verso users.id (vedi la migrazione
  // 20250720131154-add-createdBy-to-products.js): serve un utente vero per
  // ogni test che crea un prodotto valido.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let author: any;

  const productIds: number[] = [];

  beforeAll(async () => {
    author = await User.create({
      name: 'Product Model Test Author',
      email: 'product-model-test-author@example.com',
      password: 'pw',
    });
  });

  afterEach(async () => {
    // Il DELETE su products fa scattare l'ON DELETE CASCADE del DB sulle
    // righe collegate in product_images e product_categories: non serve
    // ripulirle a mano qui.
    await Product.destroy({ where: { id: productIds } });

    productIds.length = 0;
  });

  afterAll(async () => {
    await User.destroy({ where: { id: author.id } });

    await sequelize.close();
  });

  it('should default quantity to 0 and available to true, sku nullable', async () => {
    const product = await Product.create({
      name: 'Test product',
      price: 9.99,
      createdBy: author.id,
    });

    productIds.push(product.id);

    expect(product.quantity).toBe(0);

    expect(product.available).toBe(true);

    // sku non ha un defaultValue dichiarato nel modello, quindi l'istanza
    // restituita da create() lo lascia `undefined` (mai inviato nell'INSERT)
    // finché non si ricarica dal DB: reload() è quello che mostra il vero
    // NULL memorizzato da MySQL.
    await product.reload();

    expect(product.sku).toBeNull();
  });

  it('should reject a product whose createdBy does not reference an existing user', async () => {
    // Vincolo di integrità referenziale reale, non replicabile con un
    // modello mockato: 999999 non esiste in users.
    await expect(
      Product.create({ name: 'Orphan product', price: 1, createdBy: 999999 })
    ).rejects.toThrow();
  });

  it('should resolve the "creator" association back to the owning User', async () => {
    const product = await Product.create({
      name: 'Test product with creator',
      price: 5,
      createdBy: author.id,
    });

    productIds.push(product.id);

    const found = await Product.findByPk(product.id, { include: 'creator' });

    expect(found.creator.id).toBe(author.id);

    expect(found.creator.email).toBe(author.email);
  });

  it('should enforce uniqueness on sku when provided', async () => {
    const first = await Product.create({
      name: 'Sku product 1',
      price: 1,
      createdBy: author.id,
      sku: 'SKU-MODEL-TEST-1',
    });

    productIds.push(first.id);

    await expect(
      Product.create({
        name: 'Sku product 2',
        price: 1,
        createdBy: author.id,
        sku: 'SKU-MODEL-TEST-1',
      })
    ).rejects.toThrow();
  });

  it('should resolve the "images" and "categories" associations added this session', async () => {
    const product = await Product.create({
      name: 'Product with relations',
      price: 3,
      createdBy: author.id,
    });

    productIds.push(product.id);

    const image = await ProductImage.create({
      product_id: product.id,
      image_url: '/uploads/test.jpg',
    });

    const category = await Category.create({
      name: `Model test category ${Date.now()}`,
    });

    // belongsToMany aggiunge automaticamente questo helper `addCategory`,
    // che scrive la riga di join in product_categories per noi.
    await product.addCategory(category);

    const found = await Product.findByPk(product.id, {
      include: ['images', 'categories'],
    });

    expect(found.images).toHaveLength(1);

    expect(found.images[0].id).toBe(image.id);

    expect(found.categories).toHaveLength(1);

    expect(found.categories[0].id).toBe(category.id);

    // La categoria non viene rimossa a cascata dalla cancellazione del
    // prodotto (solo la riga di join lo è): va ripulita esplicitamente.
    await category.destroy({ force: true });
  });
});