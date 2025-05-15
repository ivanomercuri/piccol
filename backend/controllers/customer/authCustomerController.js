
// Import required modules and services
const {Customer} = require('../../models');
const {authenticate} = require("../../services/authService");
const {registerEntity} = require("../../services/registerService");

// Controller: Register a new customer
exports.register = async (req, res) => {
  const { email, password, firstName, lastName, address } = req.body;

  try {
    // Call registerEntity to create a new customer and generate a token
    const token = await registerEntity(
      Customer,
      { email, password, firstName, lastName, address },
      ['id', 'email']
    );

    // Return success response with a token
    return res.success(token);
  } catch (error) {
    // Handle errors and return an error response
    return res.error(500, error.message);
  }
}

// Controller: Customer login
exports.login = async (req, res) => {
  const {email, password} = req.body;

  try {
    // Authenticate customer credentials
    const user = await authenticate(Customer, email, password);
    if (user.success) {
      // Return success response with a token
      return res.success(user.token);
    } else {
      // Return an unauthorized error if authentication fails
      return res.error(401, user.message);
    }
  } catch (error) {
    // Handle errors and return an error response
    return res.error(500, error.message);
  }
};
