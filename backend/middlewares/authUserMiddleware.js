const jwt = require('jsonwebtoken');
const { User } = require('../models');
module.exports = async (req, res, next) => {
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.error(401, 'Token mancante');
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.error(401, 'Formato token non valido');
  }
  try {
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findOne({ where: { id: decoded.id } });
    
    if (!user) {
      return res.error(401, 'Utente non trovato');
    }
    
    if (user.current_token !== token) {
      return res.error(401, 'Token non più valido');
    }
    
    req.user = user;
    
    next();
  } catch (err) {
    
    return res.error(401, 'Token scaduto o non valido');
  }
};
