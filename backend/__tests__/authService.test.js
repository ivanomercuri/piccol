// backend/__tests__/authService.test.js

// Import the authenticate function to test
const { authenticate } = require('../services/authService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Test suite for the authenticate function
describe('authService.authenticate', () => {
  // Test: should return success and token if credentials are correct
  it('returns success and token if credentials are correct', async () => {
    // Create a fake user with a hashed password and a mock update method
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: await bcrypt.hash('password', 10),
      update: jest.fn()
    };
    // Mock the entityModel to return the fake user
    const entityModel = { findOne: jest.fn().mockResolvedValue(fakeUser) };
    // Set a test JWT secret
    process.env.JWT_SECRET = 'testsecret';

    // Call authenticate with correct credentials
    const result = await authenticate(entityModel, 'test@example.com', 'password');
    // Expect success to be true
    expect(result.success).toBe(true);
    // Expect a token to be returned
    expect(result.token).toBeDefined();
    // Expect the update method to be called (token update)
    expect(fakeUser.update).toHaveBeenCalled();
  });

  // Test: should fail if user is not found
  it('fails if user is not found', async () => {
    // Mock the entityModel to return null (user not found)
    const entityModel = { findOne: jest.fn().mockResolvedValue(null) };
    // Call authenticate with an email that does not exist
    const result = await authenticate(entityModel, 'notfound@example.com', 'password');
    // Expect success to be false
    expect(result.success).toBe(false);
  });

  // Test: should fail if password is incorrect
  it('fails if password is incorrect', async () => {
    // Create a fake user with a hashed password and a mock update method
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: await bcrypt.hash('password', 10),
      update: jest.fn()
    };
    // Mock the entityModel to return the fake user
    const entityModel = { findOne: jest.fn().mockResolvedValue(fakeUser) };
    // Call authenticate with the wrong password
    const result = await authenticate(entityModel, 'test@example.com', 'wrong');
    // Expect success to be false
    expect(result.success).toBe(false);
  });
});
