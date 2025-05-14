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

// Export the authenticate function
module.exports = { authenticate };

