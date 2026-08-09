'use strict';

// Campi che authService.authenticate e registerService.registerEntity
// assumono sempre presenti su qualunque modello Sequelize passato come
// entityModel: current_token per il pattern di invalidazione del token
// (vedi CLAUDE.md), email/password per il login/registrazione stessi. Prima
// di questa modifica questo era un contratto implicito, mai verificato: un
// futuro terzo modello incompatibile (es. senza colonna current_token)
// avrebbe fatto fallire il codice in modo silenzioso, diverse righe più
// sotto, con uno stack trace poco chiaro (tipo "Cannot read properties of
// undefined"). Con questo controllo esplicito, l'errore è immediato e dice
// esattamente cosa manca.
const REQUIRED_FIELDS = ['email', 'password', 'current_token'];

function assertAuthCompatible(entityModel) {
  const attributes = entityModel.getAttributes();

  const missing = REQUIRED_FIELDS.filter((field) => !(field in attributes));

  if (missing.length > 0) {
    throw new Error(
      `Il modello "${entityModel.name}" non è compatibile con authService/registerService: mancano i campi ${missing.join(', ')}`
    );
  }
}

module.exports = { assertAuthCompatible, REQUIRED_FIELDS };