// tokenService è il punto unico di firma dei JWT del progetto (introdotto
// per evitare che authService e registerService tornino a divergere sulla
// policy di scadenza, vedi services/tokenService.ts). Da questa sessione in
// poi, JWT_SECRET e JWT_EXPIRES_IN vengono letti e validati UNA SOLA VOLTA,
// al primo import del modulo — non più ad ogni chiamata di signToken() con
// un fallback silenzioso se mancanti. Questo cambia anche come si testano:
// non è più possibile "cambiare" il secret o la scadenza a runtime dentro un
// test (il modulo li ha già letti e congelati all'import), quindi i test
// che verificano la firma usano le costanti realmente in uso (importate dal
// modulo), e i test sul comportamento "variabile mancante" devono forzare un
// nuovo import isolato con jest.resetModules().
import jwt, { JwtPayload } from 'jsonwebtoken';
import { signToken, JWT_SECRET, JWT_EXPIRES_IN } from '../services/tokenService';

describe('tokenService.signToken', () => {
  // Verifica che il payload passato a signToken finisca davvero, intatto,
  // nel token firmato — il caso base che ogni chiamante (authService,
  // registerService) si aspetta funzioni.
  it('should sign a token containing the given payload', () => {
    const token = signToken({ id: 1, email: 'test@example.com' });

    // Verifichiamo con JWT_SECRET importato dal modulo stesso, non un
    // valore hardcoded: è la vera chiave usata a runtime, letta da .env.
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    expect(decoded.id).toBe(1);

    expect(decoded.email).toBe('test@example.com');
  });

  // Conferma che la scadenza del token rifletta davvero JWT_EXPIRES_IN letto
  // dall'ambiente (esportato dal modulo), non un valore hardcoded nel
  // codice di produzione.
  it('should sign tokens that expire according to JWT_EXPIRES_IN', () => {
    const token = signToken({ id: 1 });

    const decoded = jwt.decode(token) as JwtPayload;

    expect(decoded.exp).toBeDefined();

    // JWT_EXPIRES_IN in .env per questo progetto è "1h" (3600s): il test
    // resta legato al valore reale invece di assumerne uno arbitrario,
    // così si accorge se qualcuno cambia .env senza aggiornare il test.
    expect(JWT_EXPIRES_IN).toBe('1h');

    expect(decoded.exp! - decoded.iat!).toBeCloseTo(3600, -1);
  });

  // Un secret sbagliato deve far fallire la verifica: conferma che il token
  // dipende davvero dal JWT_SECRET reale, non da un valore hardcoded o
  // ignorato.
  it('should sign using the real JWT_SECRET, not an arbitrary one', () => {
    const token = signToken({ id: 1 });

    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  // Caso critico introdotto in questa sessione: senza JWT_SECRET, il modulo
  // deve rifiutarsi di caricare, non firmare token con un secret vuoto o
  // fallire più avanti con un errore criptico di jsonwebtoken. Usiamo
  // jest.resetModules() + require() per ottenere una copia "fresca" del
  // modulo, dato che l'import in cima al file è già stato eseguito (e messo
  // in cache da Node/Jest) con le variabili d'ambiente reali presenti.
  it('should throw at import time if JWT_SECRET is missing', () => {
    const original = process.env.JWT_SECRET;

    delete process.env.JWT_SECRET;

    expect(() => {
      jest.resetModules();

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../services/tokenService');
    }).toThrow(/JWT_SECRET/);

    process.env.JWT_SECRET = original;
  });

  // Stesso ragionamento del test precedente, per JWT_EXPIRES_IN: anche
  // questa è una policy di sicurezza (per quanto tempo un token resta
  // valido), non un dettaglio con cui è sicuro indovinare un default.
  it('should throw at import time if JWT_EXPIRES_IN is missing', () => {
    const original = process.env.JWT_EXPIRES_IN;

    delete process.env.JWT_EXPIRES_IN;

    expect(() => {
      jest.resetModules();

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../services/tokenService');
    }).toThrow(/JWT_EXPIRES_IN/);

    process.env.JWT_EXPIRES_IN = original;
  });
});
