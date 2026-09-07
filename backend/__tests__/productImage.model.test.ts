// Verifica i vincoli della tabella product_images contro un DB reale:
// default di sort_order, NOT NULL su image_url, relazione verso Product.
//
// Come Category, questo modello aveva `paranoid: true` in Sequelize: vedi la
// nota in category.model.test.ts e nello schema Prisma — deletedAt esiste
// ancora come colonna ma non è più gestito, quindi delete() è fisico.
import { prisma } from '../prisma/client';

describe('ProductImage model', () => {
  let author: { id: number };
  let product: { id: number };

  const imageIds: number[] = [];

  beforeAll(async () => {
    author = await prisma.user.create({
      data: {
        name: 'ProductImage Model Test Author',
        email: 'productimage-model-test-author@example.com',
        password: 'pw',
      },
    });

    product = await prisma.product.create({
      data: {
        name: 'ProductImage model test product',
        price: 1,
        createdBy: author.id,
      },
    });
  });

  afterEach(async () => {
    await prisma.productImage.deleteMany({ where: { id: { in: imageIds } } });

    imageIds.length = 0;
  });

  afterAll(async () => {
    await prisma.product.delete({ where: { id: product.id } });

    await prisma.user.delete({ where: { id: author.id } });

    await prisma.$disconnect();
  });

  it('should default sort_order to 0 when not specified', async () => {
    const image = await prisma.productImage.create({
      data: { product_id: product.id, image_url: '/uploads/a.jpg' },
    });

    imageIds.push(image.id);

    expect(image.sort_order).toBe(0);
  });

  it('should resolve the "product" relation', async () => {
    const image = await prisma.productImage.create({
      data: { product_id: product.id, image_url: '/uploads/b.jpg' },
    });

    imageIds.push(image.id);

    const found = await prisma.productImage.findUnique({
      where: { id: image.id },
      include: { product: true },
    });

    expect(found?.product.id).toBe(product.id);
  });

  it('should require image_url (NOT NULL)', async () => {
    await expect(
      prisma.productImage.create({
        data: { product_id: product.id } as never,
      })
    ).rejects.toThrow();
  });
});
