import jwt, { SignOptions } from 'jsonwebtoken';

// Nessun fallback: JWT_SECRET e JWT_EXPIRES_IN sono policy di sicurezza
// operative (la chiave di firma dei token e per quanto restano validi), non
// dettagli innocui come una porta — un default silenzioso qui vorrebbe dire
// far partire l'app con un segreto o una scadenza diversi da quelli intesi,
// senza che nessuno se ne accorga. Il controllo vive qui, al livello più
// alto del modulo: essendo eseguito al primo import (che avviene molto
// presto nella catena index.ts → routes → controllers → services, ben prima
// che server.ts chiami app.listen()), un valore mancante ferma l'avvio
// dell'intera app con un errore leggibile, invece di far fallire il primo
// login con un errore criptico di jsonwebtoken.
if (!process.env.JWT_SECRET) {
  throw new Error(
    "Variabile d'ambiente JWT_SECRET mancante. Configurala in .env prima di avviare l'app."
  );
}

if (!process.env.JWT_EXPIRES_IN) {
  throw new Error(
    "Variabile d'ambiente JWT_EXPIRES_IN mancante. Configurala in .env prima di avviare l'app."
  );
}

// Validati sopra: da qui in poi sono garantite stringhe non vuote, non più
// `string | undefined` — nessun cast necessario per usarle. Esportate
// entrambe così authUserMiddleware (che deve verificare gli stessi JWT
// firmati qui) può riusarle invece di rileggere e ricastare process.env per
// conto proprio altrove nel codice.
const JWT_SECRET = process.env.JWT_SECRET;

// Cast: la libreria `ms` (usata internamente da jsonwebtoken per
// interpretare "1h"/"2h"/ecc.) tipizza `expiresIn` con un template-literal
// type ristretto (`StringValue`), ma qui il valore arriva da env — è una
// `string` generica solo per TypeScript. A runtime la validazione del
// formato resta quella di sempre, fatta da `ms` dentro jsonwebtoken.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN as SignOptions['expiresIn'];

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
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export { signToken, JWT_SECRET, JWT_EXPIRES_IN };