const bcrypt = require('bcryptjs');
const { signToken } = require('./tokenService');
const { assertAuthCompatible } = require('./authContract');

async function authenticate(entityModel, email, password) {
  // Fallisce subito, con un errore chiaro, se entityModel non ha le colonne
  // che il resto di questa funzione assume (vedi services/authContract.js).
  assertAuthCompatible(entityModel);

  const user = await entityModel.findOne({ where: { email } });

  if (!user) {
    return { success: false, message: 'Utente non trovato' };
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return { success: false, message: 'Password errata' };
  }

  // signToken (services/tokenService.js) applica la stessa scadenza usata
  // da registerService.registerEntity: prima erano due chiamate a jwt.sign()
  // separate, ed erano finite per divergere (login senza scadenza,
  // registrazione con scadenza di un'ora).
  const token = signToken({ id: user.id, email: user.email });

  await user.update({ current_token: token });

  return { success: true, token };
}

module.exports = { authenticate };
