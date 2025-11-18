const { registerEntity } = require('../services/registerService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('registerService.registerEntity', () => {
  it('registers a new user and returns a token', async () => {
    const entityModel = {
      create: jest.fn().mockImplementation(async (data) => ({
        ...data,
        id: 1,
        update: jest.fn(),
      })),
    };

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
});
