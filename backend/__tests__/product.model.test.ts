// Verifica contro un DB reale i vincoli e le relazioni della tabella
// products: default di quantity/available, FK verso users, unicità di sku e
// navigazione delle relazioni.
//
// Nota sulla migrazione a Prisma: la relazione N:N con Category resta
// modellata sulla tabella ponte esplicita (ha campi propri), quindi non
// esiste più un `product.categories` diretto né l'helper `addCategory()` di
// Sequelize — si passa da productCategories, creando la riga di join in
// modo esplicito. È più verboso, ma rende visibile ciò che prima accadeva
// dietro un helper generato.
import { prisma } from '../prisma/client';

describe('Product model', () => {
  let author: { id: number };

  const productIds: number[] = [];

  beforeAll(async () => {
    author = await prisma.user.create({
      data: {
        name: 'Product Model Test Author',
        email: 'product-model-test-author@example.com',
        password: 'pw',
      },
    });
  });

  afterEach(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });

    productIds.length = 0;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: author.id } });

    await prisma.$disconnect();
  });

  it('should default quantity to 0 and available to true, sku nullable', async () => {
    const product = await prisma.product.create({
      data: { name: 'Defaults product', price: 1, createdBy: author.id },
    });

    productIds.push(product.id);

    expect(product.quantity).toBe(0);

    expect(product.available).toBe(true);

    expect(product.sku).toBeNull();
  });

  it('should reject a product whose createdBy does not reference an existing user', async () => {
    await expect(
      prisma.product.create({
        data: { name: 'Orphan product', price: 1, createdBy: 999999 },
      })
    ).rejects.toThrow();
  });

  it('should resolve the "creator" relation back to the owning User', async () => {
    const product = await prisma.product.create({
      data: { name: 'Product with creator', price: 2, createdBy: author.id },
    });

    productIds.push(product.id);

    const found = await prisma.product.findUnique({
      where: { id: product.id },
      include: { creator: true },
    });

    expect(found?.creator.id).toBe(author.id);
  });

  it('should enforce uniqueness on sku when provided', async () => {
    const first = await prisma.product.create({
      data: {
        name: 'Sku product 1',
        price: 1,
        createdBy: author.id,
        sku: 'SKU-MODEL-TEST-1',
      },
    });

    productIds.push(first.id);

    await expect(
      prisma.product.create({
        data: {
          name: 'Sku product 2',
          price: 1,
          createdBy: author.id,
          sku: 'SKU-MODEL-TEST-1',
        },
      })
    ).rejects.toThrow();
  });

  it('should resolve the "images" and category relations', async () => {
    const product = await prisma.product.create({
      data: { name: 'Product with relations', price: 3, createdBy: author.id },
    });

    productIds.push(product.id);

    const image = await prisma.productImage.create({
      data: { product_id: product.id, image_url: '/uploads/test.jpg' },
    });

    const category = await prisma.category.create({
      data: { name: `Model test category ${Date.now()}` },
    });

    // Senza l'helper addCategory() di Sequelize, la riga di join si crea
    // esplicitamente: è la stessa scrittura che l'helper faceva per noi.
    await prisma.productCategory.create({
      data: { product_id: product.id, category_id: category.id },
    });

    const found = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        images: true,
        // La categoria si raggiunge attraversando la tabella ponte, non più
        // con un `categories` diretto.
        productCategories: { include: { category: true } },
      },
    });

    expect(found?.images).toHaveLength(1);

    expect(found?.images[0].id).toBe(image.id);

    expect(found?.productCategories).toHaveLength(1);

    expect(found?.productCategories[0].category.id).toBe(category.id);

    // La categoria non viene rimossa a cascata dalla cancellazione del
    // prodotto (solo la riga di join lo è): va ripulita esplicitamente.
    await prisma.category.delete({ where: { id: category.id } });
  });
});
