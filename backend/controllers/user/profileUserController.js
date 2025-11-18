const bcrypt = require('bcryptjs');

exports.getProfileUser = (req, res) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }
  const { id, name, email, level } = user;
  const returnUser = { id, name, email, level };

  return res.success(returnUser);
};

exports.updateProfileUser = async (req, res) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }
  const { name, email } = req.body;

  try {
    if (name) user.name = name;
    if (email) user.email = email;
    await user.save();
    const updatedUser = { id: user.id, name: user.name, email: user.email };

    return res.success(updatedUser);
  } catch (err) {
    return res.error(500, "Errore durante l'aggiornamento del profilo");
  }
};

exports.changePassword = async (req, res) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }
  const { oldPassword, newPassword } = req.body;

  try {
    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.error(400, 'La vecchia password non corrisponde');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await user.save();

    return res.success({}, 'Password aggiornata con successo');
  } catch (err) {
    return res.error(500, 'Errore durante il cambio della password');
  }
};

exports.logout = async (req, res) => {
  const { user } = req;

  if (!user) {
    return res.error(401, 'Utente non trovato');
  }
  try {
    user.current_token = null;

    await user.save();

    return res.success({}, 'Logout effettuato con successo');
  } catch (err) {
    return res.error(500, 'Errore durante il logout');
  }
};
