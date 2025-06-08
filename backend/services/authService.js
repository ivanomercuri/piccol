// Import required modules
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");

/**
 * Authenticate a user or customer by email and password.
 * @param {Model} entityModel - The Sequelize model (User or Customer)
 * @param {string} email - The email to search for
 * @param {string} password - The plain password to verify
 * @returns {Object} - Authentication result with token if successful
 */
async function authenticate(entityModel, email, password) {
  // Find user/customer by email
  const user = await entityModel.findOne({ where: { email } });

  // If user not found, return failure
  if (!user) {
    return { success: false, message: 'Utente non trovato' };
  }

  // Compare provided password with hashed password
  const passwordMatch = await bcrypt.compare(password, user.password);

  // If password does not match, return failure
  if (!passwordMatch) {
    return { success: false, message: 'Password errata' };
  }

  // Check if a current_token exists and is valid
  if (user.current_token) {
    try {
      jwt.verify(user.current_token, process.env.JWT_SECRET);
      // Token is valid and not expired
      return { success: true, token: user.current_token };
    } catch (err) {
      throw err;
    }
  }

  // Generate JWT token for authenticated user
  const token = jwt.sign(
    {id: user.id, email: user.email},
    process.env.JWT_SECRET,
    {expiresIn: '1h'}
  );

  // Update user with the current token
  await user.update({ current_token: token });

  // Return success and token
  return { success: true, token };
}

/**
 * Logout a user or customer by clearing their current_token.
 * @param {Model} entityModel - The Sequelize model (User or Customer)
 * @param {string} email - The email of the user/customer
 * @returns {Object} - Result of the operation
 */
async function logout(entityModel, email) {
  const user = await entityModel.findOne({ where: { email } });
  if (!user) {
    return { success: false, message: 'User not found' };
  }
  await user.update({ current_token: null });
  return { success: true };
}

// Export the authenticate function
module.exports = { authenticate, logout };

