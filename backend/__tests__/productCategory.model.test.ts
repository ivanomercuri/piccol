// ProductCategory è la tabella di join: l'unica cosa davvero interessante da
// verificare con un DB reale è l'indice univoco su (product_id, category_id)
// creato dalla migrazione (product_category_unique_idx), che impedisce di
// associare due volte lo stesso prodotto alla stessa categoria.
//
// Con Prisma questa tabella resta un modello esplicito (ha campi propri:
// id, createdAt, updatedAt), non una relazione N:N implicita — quindi la
// riga di join si crea e si verifica direttamente, come qui sotto.
import { prisma } from '../prisma/client';

describe('ProductCategory model', () => {
  let author: { id: number };
  let product: { id: number };
  let category: { id: number };

  beforeAll(async () => {
    author = await prisma.user.create({
      data: {
        name: 'ProductCategory Model Test Author',
        email: 'productcategory-model-test-author@example.com',
        password: 'pw',
      },
    });

    product = await prisma.product.create({
      data: {
        name: 'ProductCategory model test product',
        price: 1,
        createdBy: author.id,
      },
    });

    category = await prisma.category.create({
      data: { name: `ProductCategory model test category ${Date.now()}` },
    });
  });

  afterAll(async () => {
    // Cancellare il prodotto rimuove a cascata anche la riga di join
    // (onDelete: Cascade sulla FK, vedi schema.prisma).
    await prisma.product.delete({ where: { id: product.id } });

    await prisma.category.delete({ where: { id: category.id } });

    await prisma.user.delete({ where: { id: author.id } });

    await prisma.$disconnect();
  });

  it('should create a join row linking a product and a category', async () => {
    const link = await prisma.productCategory.create({
      data: { product_id: product.id, category_id: category.id },
    });

    expect(link.id).toBeDefined();

    await prisma.productCategory.delete({ where: { id: link.id } });
  });

  it('should reject a duplicate (product_id, category_id) pair via the unique index', async () => {
    const first = await prisma.productCategory.create({
      data: { product_id: product.id, category_id: category.id },
    });

    await expect(
      prisma.productCategory.create({
        data: { product_id: product.id, category_id: category.id },
      })
    ).rejects.toThrow();

    await prisma.productCategory.delete({ where: { id: first.id } });
  });
});
