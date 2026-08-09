const bcrypt = require('bcryptjs');
const { signToken } = require('./tokenService');
const { assertAuthCompatible } = require('./authContract');

async function registerEntity(entityModel, userData, tokenPayloadFields) {
  // Fallisce subito, con un errore chiaro, se entityModel non ha le colonne
  // che il resto di questa funzione assume (vedi services/authContract.js).
  assertAuthCompatible(entityModel);

  const { password, ...otherFields } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);

  const newEntity = await entityModel.create({
    ...otherFields,
    password: hashedPassword,
  });

  const tokenPayload = {};

  for (const field of tokenPayloadFields) {
    tokenPayload[field] = newEntity[field];
  }

  // signToken (services/tokenService.js) è lo stesso punto usato da
  // authService.authenticate: un solo posto dove la scadenza del token è
  // decisa, per non lasciare che le due funzioni tornino a divergere.
  const token = signToken(tokenPayload);

  await newEntity.update({ current_token: token });

  return token;
}

module.exports = { registerEntity };
