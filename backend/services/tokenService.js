'use strict';

const jwt = require('jsonwebtoken');

// Scadenza di fallback, usata solo se JWT_EXPIRES_IN non è impostata
// nell'ambiente (es. .env non aggiornato): mantiene il progetto funzionante
// invece di rompere silenziosamente l'emissione dei token. Il valore vero e
// proprio va invece configurato via env, come JWT_SECRET — è una policy di
// sicurezza operativa (quanto dura un token prima di dover rifare login),
// non una costante di codice: deve poter cambiare per ambiente (es. più
// corta in produzione) senza una modifica al codice e un redeploy.
const DEFAULT_TOKEN_EXPIRES_IN = '1h';

/**
 * Punto unico di firma dei JWT del progetto. authService e registerService
 * devono passare da qui invece di chiamare jwt.sign() direttamente, così la
 * policy di scadenza (e qualunque altra opzione futura, es. un algoritmo di
 * firma diverso) vive in un solo posto invece che duplicata in due file, e
 * non c'è più il rischio che le due funzioni tornino a divergere in
 * silenzio come accadeva prima di questa modifica (login senza scadenza,
 * registrazione con scadenza di un'ora).
 */
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_TOKEN_EXPIRES_IN,
  });
}

module.exports = { signToken, DEFAULT_TOKEN_EXPIRES_IN };