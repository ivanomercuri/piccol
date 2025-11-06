const { authenticate } = require('../services/authService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
describe('authService.authenticate', () => {
  
  it('returns success and token if credentials are correct', async () => {
    
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: await bcrypt.hash('password', 10),
      update: jest.fn()
    };
    
    const entityModel = { findOne: jest.fn().mockResolvedValue(fakeUser) };
    
    process.env.JWT_SECRET = 'testsecret';
    
    const result = await authenticate(entityModel, 'test@example.com', 'password');
    
    expect(result.success).toBe(true);
    
    expect(result.token).toBeDefined();
    
    expect(fakeUser.update).toHaveBeenCalled();
  });
  
  it('fails if user is not found', async () => {
    
    const entityModel = { findOne: jest.fn().mockResolvedValue(null) };
    
    const result = await authenticate(entityModel, 'notfound@example.com', 'password');
    
    expect(result.success).toBe(false);
  });
  
  it('fails if password is incorrect', async () => {
    
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: await bcrypt.hash('password', 10),
      update: jest.fn()
    };
    
    const entityModel = { findOne: jest.fn().mockResolvedValue(fakeUser) };
    
    const result = await authenticate(entityModel, 'test@example.com', 'wrong');
    
    expect(result.success).toBe(false);
  });
});
