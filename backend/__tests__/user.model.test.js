// Primo test che parla con un DB reale (mydatabase_test, creato/migrato in
// automatico dallo script "pretest" di package.json) invece di mockare
// tutto: qui vogliamo verificare che i vincoli dichiarati nel modello User
// (unique, allowNull, default di `level`/`current_token`) siano davvero
// applicati, cosa che un test con modello mockato non potrebbe mai fare.
const { User, sequelize } = require('../models');

describe('User model', () => {
  // Teniamo traccia degli id creati in ogni test per ripulirli in
  // afterEach: senza questo, rilanciare la suite una seconda volta
  // fallirebbe per violazione dello UNIQUE su email.
  const createdIds = [];

  afterEach(async () => {
    await User.destroy({ where: { id: createdIds } });

    createdIds.length = 0;
  });

  afterAll(async () => {
    // Ogni file di test apre una propria connessione Sequelize (Jest isola
    // il require cache per file): va chiusa esplicitamente o il processo
    // Jest resta appeso in attesa che il pool si liberi.
    await sequelize.close();
  });

  it('should default level to "admin" and current_token to null on creation', async () => {
    const user = await User.create({
      name: 'Test User',
      email: 'user-model-test-1@example.com',
      password: 'hashed-password',
    });

    createdIds.push(user.id);

    expect(user.level).toBe('admin');

    expect(user.current_token).toBeNull();
  });

  it('should allow level to be explicitly set to "superadmin"', async () => {
    const user = await User.create({
      name: 'Super',
      email: 'user-model-test-2@example.com',
      password: 'hashed-password',
      level: 'superadmin',
    });

    createdIds.push(user.id);

    expect(user.level).toBe('superadmin');
  });

  it('should reject a duplicate email via the DB unique constraint', async () => {
    const first = await User.create({
      name: 'First',
      email: 'user-model-test-dup@example.com',
      password: 'pw',
    });

    createdIds.push(first.id);

    await expect(
      User.create({
        name: 'Second',
        email: 'user-model-test-dup@example.com',
        password: 'pw',
      })
    ).rejects.toThrow();
  });

  it('should require name, email and password (allowNull: false)', async () => {
    await expect(User.create({})).rejects.toThrow();
  });
});