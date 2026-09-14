// RIDOTTO NELLA FASE F3 della migrazione a NestJS, destinato a sparire in F4.
//
// Fino a F3 questo file era il punto unico di firma dei JWT (signToken) e
// della loro policy di scadenza. Dalla fase F3 quella responsabilità è in
// modules/auth/auth.module.ts, dove JwtService riceve segreto, algoritmo e
// scadenza da ConfigService, e ogni firma passa da CredentialsService.
//
// Resta soltanto il segreto, perché lo usa ancora
// middlewares/authUserMiddleware.ts per VERIFICARE i token sulle rotte legacy
// dei prodotti. Quando in F4 anche quelle rotte migreranno ad AuthUserGuard,
// middleware e file potranno essere cancellati insieme.
//
// Nessun fallback: senza JWT_SECRET il modulo si rifiuta di caricarsi, e
// l'app non parte. Controllo a livello di modulo, eseguito al primo import,
// come prima.
if (!process.env.JWT_SECRET) {
  throw new Error(
    'Missing JWT_SECRET environment variable. Set it in .env before starting the app.'
  );
}

// Validato sopra: da qui in poi è garantita una stringa non vuota, non più
// `string | undefined` — nessun cast necessario per usarla.
const JWT_SECRET = process.env.JWT_SECRET;

export { JWT_SECRET };
