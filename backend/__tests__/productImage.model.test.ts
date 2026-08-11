import models from '../models';

const { ProductImage, Product, User, sequelize } = models;

describe('ProductImage model', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let author: any;
  let product: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const imageIds: number[] = [];

  beforeAll(async () => {
    author = await User.create({
      name: 'ProductImage Model Test Author',
      email: 'productimage-model-test-author@example.com',
      password: 'pw',
    });

    product = await Product.create({
      name: 'ProductImage model test product',
      price: 1,
      createdBy: author.id,
    });
  });

  afterEach(async () => {
    await ProductImage.destroy({
      where: { id: imageIds },
      force: true,
      paranoid: false,
    });

    imageIds.length = 0;
  });

  afterAll(async () => {
    // Cancellare il prodotto qui rimuoverebbe comunque a cascata eventuali
    // immagini rimaste, ma l'afterEach sopra dovrebbe già averle ripulite.
    await Product.destroy({ where: { id: product.id } });

    await User.destroy({ where: { id: author.id } });

    await sequelize.close();
  });

  it('should default sort_order to 0 when not specified', async () => {
    const image = await ProductImage.create({
      product_id: product.id,
      image_url: '/uploads/a.jpg',
    });

    imageIds.push(image.id);

    expect(image.sort_order).toBe(0);
  });

  it('should resolve the "product" association', async () => {
    const image = await ProductImage.create({
      product_id: product.id,
      image_url: '/uploads/b.jpg',
    });

    imageIds.push(image.id);

    const found = await ProductImage.findByPk(image.id, {
      include: 'product',
    });

    expect(found.product.id).toBe(product.id);
  });

  it('should require image_url (allowNull: false)', async () => {
    await expect(
      ProductImage.create({ product_id: product.id })
    ).rejects.toThrow();
  });
});