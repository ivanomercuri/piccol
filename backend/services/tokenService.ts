import jwt, { SignOptions } from 'jsonwebtoken';

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
function signToken(payload: Record<string, unknown>): string {
  // Cast esplicito: process.env.JWT_SECRET è tipizzato `string | undefined`
  // da Node, ma jwt.sign() richiede un Secret non-undefined. Il cast NON
  // aggiunge un controllo a runtime che prima non c'era — se la variabile
  // manca davvero, jwt.sign() continua a fallire a runtime esattamente come
  // nel file .js originale (nessuna guardia esplicita esisteva né viene
  // aggiunta ora). È un gap pre-esistente, reso visibile dalla tipizzazione
  // ma non corretto qui di proposito, per non cambiare comportamento.
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    // Altro cast dello stesso tipo del precedente: la libreria `ms` (usata
    // internamente da jsonwebtoken per interpretare "1h"/"2h"/ecc.) tipizza
    // `expiresIn` con un template-literal type ristretto (`StringValue`),
    // ma qui il valore arriva da env — è una `string` generica solo per
    // TypeScript. A runtime la validazione del formato resta quella di
    // sempre, fatta da `ms` dentro jsonwebtoken (invariata rispetto al file
    // .js originale, che non aveva alcun controllo qui).
    expiresIn: (process.env.JWT_EXPIRES_IN ||
      DEFAULT_TOKEN_EXPIRES_IN) as SignOptions['expiresIn'],
  });
}

export { signToken, DEFAULT_TOKEN_EXPIRES_IN };