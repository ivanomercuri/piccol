
// Import required modules
const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware to authenticate a user using JWT
module.exports = async (req, res, next) => {
  // Get Authorization header
  const authHeader = req.headers.authorization;

  // Check if the Authorization header is present
  if (!authHeader) {
    return res.error(401, 'Token mancante');
  }

  // Extract token from header (format: 'Bearer TOKEN')
  const token = authHeader.split(' ')[1];

  // Check if a token is present
  if (!token) {
    return res.error(401, 'Formato token non valido');
  }

  try {
    // Verify token and decode payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user by decoded id
    const user = await User.findOne({ where: { id: decoded.id } });

    // Check if a user exists
    if (!user) {
      return res.error(401, 'Utente non trovato');
    }

    // Check if the token matches the user's current token
    if (user.current_token !== token) {
      return res.error(401, 'Token non più valido');
    }

    // Attach a user to request an object for further use
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    // Handle invalid or expired token
    return res.error(401, 'Token scaduto o non valido');
  }
};
