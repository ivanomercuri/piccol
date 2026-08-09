const { registerEntity } = require('../services/registerService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Come in authService.test.js: assertAuthCompatible (services/authContract.js)
// controlla la forma del modello prima di procedere, quindi il mock deve
// esporre getAttributes() con i campi richiesti.
const compatibleAttributes = () => ({
  email: {},
  password: {},
  current_token: {},
});

function makeEntityModel() {
  return {
    name: 'FakeEntity',
    getAttributes: compatibleAttributes,
    create: jest.fn().mockImplementation(async (data) => ({
      ...data,
      id: 1,
      update: jest.fn(),
    })),
  };
}

describe('registerService.registerEntity', () => {
  it('registers a new user and returns a token', async () => {
    const entityModel = makeEntityModel();

    process.env.JWT_SECRET = 'testsecret';

    const userData = {
      name: 'Test',
      email: 'test@example.com',
      password: 'password',
    };

    const tokenPayloadFields = ['id', 'email'];

    const token = await registerEntity(
      entityModel,
      userData,
      tokenPayloadFields
    );

    expect(token).toBeDefined();

    expect(entityModel.create).toHaveBeenCalled();
  });

  it('issues a token that expires in 1 hour, same policy as authenticate', async () => {
    const entityModel = makeEntityModel();

    process.env.JWT_SECRET = 'testsecret';

    const token = await registerEntity(
      entityModel,
      { name: 'Test', email: 'test@example.com', password: 'password' },
      ['id', 'email']
    );

    const decoded = jwt.decode(token);

    expect(decoded.exp).toBeDefined();

    expect(decoded.exp - decoded.iat).toBeCloseTo(3600, -1);
  });

  it('throws immediately if entityModel is missing a required auth field', async () => {
    const entityModel = {
      name: 'IncompleteModel',
      getAttributes: () => ({ email: {}, password: {} }),
      create: jest.fn(),
    };

    await expect(
      registerEntity(
        entityModel,
        { email: 'test@example.com', password: 'password' },
        ['id', 'email']
      )
    ).rejects.toThrow(/IncompleteModel.*current_token/);

    expect(entityModel.create).not.toHaveBeenCalled();
  });
});
