// Import required modules
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Register a new user or customer entity.
 * @param {Model} entityModel - The Sequelize model (User or Customer)
 * @param {Object} userData - The registration data (including password)
 * @param {Array} tokenPayloadFields - Fields to include in the JWT payload
 * @returns {string} - The generated JWT token
 */
async function registerEntity(entityModel, userData, tokenPayloadFields) {
  // Extract and hash the password
  const { password, ...otherFields } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create the new entity in the database
  const newEntity = await entityModel.create({
    ...otherFields,
    password: hashedPassword
  });

  // Prepare the payload for the JWT token
  const tokenPayload = {};
  for (const field of tokenPayloadFields) {
    tokenPayload[field] = newEntity[field];
  }

  // Generate JWT token for the new entity
  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Update the entity with the current token
  await newEntity.update({ current_token: token });

  // Return the generated token
  return token;
}

// Export the registerEntity function
module.exports = { registerEntity };

