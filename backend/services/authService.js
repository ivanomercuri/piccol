const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function authenticate(entityModel, email, password) {
  const user = await entityModel.findOne({ where: { email } });

  if (!user) {
    return { success: false, message: 'Utente non trovato' };
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return { success: false, message: 'Password errata' };
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET
    //{ expiresIn: '1h' }
  );

  await user.update({ current_token: token });

  return { success: true, token };
}

module.exports = { authenticate };
