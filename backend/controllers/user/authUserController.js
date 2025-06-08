
// Import required modules and services
const {User} = require('../../models');
const {authenticate, logout} = require('../../services/authService');
const {registerEntity} = require('../../services/registerService');

// Controller: Register a new user
exports.register = async (req, res) => {
  const {name, email, password} = req.body;

  try {
    // Call registerEntity to create a new user and generate a token
    const token = await registerEntity(
      User,
      { name, email, password },
      ['id', 'email']
    );

    // Return success response with a token
    return res.success(token);
  } catch (error) {
    // Handle errors and return an error response
    return res.error(500, error.message);
  }
}

// Controller: User login
exports.login = async (req, res) => {
  const {email, password} = req.body;
  try {
    // Authenticate user credentials
    const user = await authenticate(User, email, password);
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

// Controller: User logout
exports.logout = async (req, res) => {
  const { user } = req;
  if (!user) {
    return res.error(401, 'Utente non trovato');
  }

  try {
    // Usa la funzione di servizio per il logout
    const result = await logout(User, user.email);
    if (result.success) {
      return res.success({}, 'Logout effettuato con successo');
    } else {
      return res.error(404, result.message);
    }
  } catch (error) {
    return res.error(500, 'Errore durante il logout');
  }
};