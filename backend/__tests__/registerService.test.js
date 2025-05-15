// backend/__tests__/registerService.test.js

// Import the registerEntity function to test
const { registerEntity } = require('../services/registerService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Test suite for the registerEntity function
describe('registerService.registerEntity', () => {
  // Test: should register a new user and return a token
  it('registers a new user and returns a token', async () => {
    // Mock the entityModel.create method to simulate DB insertion
    const entityModel = {
      create: jest.fn().mockImplementation(async (data) => ({
        ...data,
        id: 1, // Simulate DB-generated ID
        update: jest.fn() // Mock update method for token update
      }))
    };
    // Set a test JWT secret for token generation
    process.env.JWT_SECRET = 'testsecret';
    // Example user data for registration
    const userData = { name: 'Test', email: 'test@example.com', password: 'password' };
    // Fields to include in the JWT payload
    const tokenPayloadFields = ['id', 'email'];

    // Call the registerEntity function with mock data
    const token = await registerEntity(entityModel, userData, tokenPayloadFields);
    // Assert that a token is returned
    expect(token).toBeDefined();
    // Assert that the create method was called (user was created)
    expect(entityModel.create).toHaveBeenCalled();
  });
});
