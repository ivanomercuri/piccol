// controllers/authUserController.js
const bcrypt = require('bcryptjs');
const {User} = require('../models');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {

  const {email, password} = req.body;

  try {
    const user = await User.findOne({where: {email}});

    if (!user) {
      return res.error(401, 'Utente non trovato');
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.error(401, 'Password errata');
    }

    const token = jwt.sign(
      {id: user.id, email: user.email},
      process.env.JWT_SECRET,
      {expiresIn: '1h'}
    );

    await user.update({ current_token: token });

    return res.success(token);
  } catch (error) {
    return res.error(500, error.message);
  }
};
