'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Allinea i dati già presenti all'invariante introdotto con la
    // migrazione a PostgreSQL: le email sono sempre salvate in minuscolo
    // (vedi services/emailNormalizer.ts). Senza questo passaggio, una riga
    // salvata in precedenza come "Mario@x.com" resterebbe irraggiungibile
    // al login, perché authService cerca ormai solo la forma normalizzata.
    //
    // Sicuro rispetto al vincolo UNIQUE: i dati provengono da MySQL, dove
    // la collation case-insensitive impediva già l'esistenza di due email
    // che differiscono solo per maiuscole/minuscole — quindi questa UPDATE
    // non può generare duplicati. Su un database già nativo PostgreSQL con
    // duplicati di questo tipo andrebbero invece riconciliati a mano prima.
    await queryInterface.sequelize.query(
      'UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email);'
    );

    await queryInterface.sequelize.query(
      'UPDATE customers SET email = LOWER(email) WHERE email <> LOWER(email);'
    );
  },

  async down() {
    // Nessun rollback possibile: il casing originale non è recuperabile
    // una volta convertito in minuscolo. Lasciare il down vuoto è
    // deliberato — l'alternativa sarebbe far fallire il rollback dell'intera
    // catena di migration per un dato che comunque non si può ripristinare.
  },
};
