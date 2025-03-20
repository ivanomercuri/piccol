// controllers/authController.js
const bcrypt = require('bcryptjs');
const {User} = require('../models');
const {validationResult} = require("express-validator");

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // se ci sono errori, invia una risposta con gli errori
    return res.status(400).json({errors: errors.array()});
  }

  const {email, password} = req.body;

  try {
    const user = await User.findOne({where: {email}});

    if (!user) {
      return res.status(401).json({message: 'Utente non trovato'});
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({message: 'Password errata'});
    }

    // Qui potresti generare un JWT Token
    // esempio: const token = jwt.sign({id: user.id}, secret)

    res.json({message: 'Login effettuato con successo'});
  } catch (error) {
    res.status(500).json({message: 'Errore server', error: error.message});
  }
};
