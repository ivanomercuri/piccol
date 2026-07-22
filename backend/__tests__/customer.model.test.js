// Il modello Customer è l'unico, tra i sei, ad avere una validazione di
// FORMATO (isEmail) oltre al vincolo di unicità — a differenza di User, che
// accetta qualunque stringa non vuota come email. Vale la pena verificarlo
// con un DB reale perché è un errore lanciato da Sequelize PRIMA di
// interrogare il DB (SequelizeValidationError), non un errore SQL.
const { Customer, sequelize } = require('../models');

describe('Customer model', () => {
  const createdIds = [];

  afterEach(async () => {
    await Customer.destroy({ where: { id: createdIds } });

    createdIds.length = 0;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create a customer with all required fields, address optional', async () => {
    const customer = await Customer.create({
      email: 'customer-model-test-1@example.com',
      password: 'pw',
      firstName: 'Mario',
      lastName: 'Rossi',
    });

    createdIds.push(customer.id);

    // Né current_token né address hanno un defaultValue dichiarato nel
    // modello: come per Product.sku, l'istanza restituita da create() li
    // lascia `undefined` finché non si ricarica dal DB.
    await customer.reload();

    expect(customer.current_token).toBeNull();

    expect(customer.address).toBeNull();
  });

  it('should reject a value that is not a valid email format (model-level isEmail validator)', async () => {
    await expect(
      Customer.create({
        email: 'not-an-email',
        password: 'pw',
        firstName: 'Mario',
        lastName: 'Rossi',
      })
    ).rejects.toThrow();
  });

  it('should reject a duplicate email via the DB unique constraint', async () => {
    const first = await Customer.create({
      email: 'customer-model-test-dup@example.com',
      password: 'pw',
      firstName: 'A',
      lastName: 'B',
    });

    createdIds.push(first.id);

    await expect(
      Customer.create({
        email: 'customer-model-test-dup@example.com',
        password: 'pw',
        firstName: 'C',
        lastName: 'D',
      })
    ).rejects.toThrow();
  });

  it('should require firstName, lastName, email and password', async () => {
    await expect(Customer.create({})).rejects.toThrow();
  });
});