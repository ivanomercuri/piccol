// backend/__tests__/authService.test.js

jest.mock('../services/authService', () => ({
  ...jest.requireActual('../services/authService'),
  logout: jest.fn(),
}));

// Import the authenticate function to test
const authService = require('../services/authService');
const {authenticate} = authService;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Test suite for the authenticate function
describe('authService.authenticate', () => {

  let req, res;

  beforeEach(() => {
    req = {user: {email: 'test@example.com'}};
    res = {
      success: jest.fn(),
      error: jest.fn()
    };
  });

  //afterEach(() => {
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
      const entityModel = {findOne: jest.fn().mockResolvedValue(fakeUser)};
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
      const entityModel = {findOne: jest.fn().mockResolvedValue(null)};
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
      const entityModel = {findOne: jest.fn().mockResolvedValue(fakeUser)};
      // Call authenticate with the wrong password
      const result = await authenticate(entityModel, 'test@example.com', 'wrong');
      // Expect success to be false
      expect(result.success).toBe(false);
    });

    it('fails if user is not found', async () => {
      // Mock the entityModel to return null (user not found)
      const entityModel = {findOne: jest.fn().mockResolvedValue(null)};

      // Call authenticate with an email that does not exist
      const result = await authenticate(entityModel, 'mario@example.com', 'password');
    });

    it('returns error if JWT secret is not set', async () => {
      // Remove the JWT_SECRET environment variable
      delete process.env.JWT_SECRET;

      // Create a fake user with a hashed password and a mocked update method
      const fakeUser = {
        id: 1,
        email: 'test@example.com',
        password: await bcrypt.hash('password', 10),
        update: jest.fn()
      };
      // Mock the entityModel to return the fake user
      const entityModel = {findOne: jest.fn().mockResolvedValue(fakeUser)};

      // Expect the authenticate function to throw if JWT_SECRET is missing
      await expect(authenticate(entityModel, 'test@example.com', 'password'))
        .rejects
        .toThrow();
    });

    it('returns error if JWT secret is invalid', async () => {
      // Set an invalid JWT_SECRET (empty string)
      process.env.JWT_SECRET = '';

      // Create a fake user with a hashed password and a mocked update method
      const fakeUser = {
        id: 1,
        email: 'test@example.com',
        password: await bcrypt.hash('password', 10),
        update: jest.fn()
      };
      // Mock the entityModel to return the fake user
      const entityModel = {findOne: jest.fn().mockResolvedValue(fakeUser)};

      // Expect the authenticate function to throw if JWT_SECRET is invalid
      await expect(authenticate(entityModel, 'test@example.com', 'password'))
        .rejects
        .toThrow();
    });

    it('returns error if JWT is expired', async () => {
      // Set a valid JWT_SECRET
      process.env.JWT_SECRET = 'testsecret';
      let fakeId = 1;
      let fakeMail = 'test@example.com';

      // Generate an expired JWT token
      const expiredToken = jwt.sign(
        {id: fakeId, email: fakeMail},
        process.env.JWT_SECRET,
        {expiresIn: '-1h'} // Token expired 1 hour ago
      );

      // Create a fake user with a hashed password and a mocked update method
      const fakeUser = {
        id: fakeId,
        email: fakeMail,
        password: await bcrypt.hash('password', 10),
        update: jest.fn(),
        current_token: expiredToken
      };
      // Mock the entityModel to return the fake user
      const entityModel = {findOne: jest.fn().mockResolvedValue(fakeUser)};

      // Mock the update method to set the expired token
      fakeUser.update.mockResolvedValue({current_token: expiredToken});

      // Expect the authenticate function to throw due to expired token
      await expect(authenticate(entityModel, 'test@example.com', 'password'))
        .rejects
        .toThrow(/jwt expired/i);
    });

    it('returns error if JWT is malformed', async () => {
      process.env.JWT_SECRET = 'testsecret';

      // Token malformato (stringa non JWT)
      const malformedToken = 'not.a.valid.jwt';

      const fakeUser = {
        id: 1,
        email: 'test@example.com',
        password: await bcrypt.hash('password', 10),
        update: jest.fn(),
        current_token: malformedToken
      };
      const entityModel = {findOne: jest.fn().mockResolvedValue(fakeUser)};

      await expect(authenticate(entityModel, 'test@example.com', 'password'))
        .rejects
        .toThrow(/jwt malformed/i);
    });

    it('should logout successfully', async () => {
      authService.logout.mockResolvedValue({success: true});

      await authService.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith(User, 'test@example.com');
      expect(res.success).toHaveBeenCalledWith({}, 'Logout effettuato con successo');
    });

    it('should return 404 if user not found', async () => {
      authService.logout.mockResolvedValue({success: false, message: 'User not found'});

      await authService.logout(req, res);

      expect(res.error).toHaveBeenCalledWith(404, 'User not found');
    });

    it('should return 401 if req.user is missing', async () => {
      req.user = null;

      await authService.logout(req, res);

      expect(res.error).toHaveBeenCalledWith(401, 'Utente non trovato');
    });

    it('should handle service errors', async () => {
      authService.logout.mockRejectedValue(new Error('DB error'));

      await authService.logout(req, res);

      expect(res.error).toHaveBeenCalledWith(500, 'Errore durante il logout');
    });

  //});

});
