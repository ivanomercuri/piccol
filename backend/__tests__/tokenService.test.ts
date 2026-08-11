// tokenService è il punto unico di firma dei JWT introdotto per evitare che
// authService e registerService tornino a divergere sulla policy di
// scadenza (era già successo una volta, vedi services/tokenService.ts). La
// scadenza è configurabile via env (JWT_EXPIRES_IN), con un fallback interno
// solo per non rompere l'emissione dei token se qualcuno dimentica di
// impostarla.
import jwt, { JwtPayload } from 'jsonwebtoken';
import { signToken, DEFAULT_TOKEN_EXPIRES_IN } from '../services/tokenService';

describe('tokenService.signToken', () => {
  const originalExpiresIn = process.env.JWT_EXPIRES_IN;

  beforeEach(() => {
    process.env.JWT_SECRET = 'testsecret';
  });

  afterEach(() => {
    // Ripristina lo stato dell'env tra un test e l'altro, così i test su
    // JWT_EXPIRES_IN non si influenzano a vicenda.
    if (originalExpiresIn === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = originalExpiresIn;
    }
  });

  it('should sign a token containing the given payload', () => {
    const token = signToken({ id: 1, email: 'test@example.com' });

    // Cast: jwt.verify() restituisce `string | JwtPayload` (potrebbe
    // decodificare un payload che è una stringa semplice) — qui, come nel
    // file .js originale, si assume sempre un payload oggetto.
    const decoded = jwt.verify(token, 'testsecret') as JwtPayload;

    expect(decoded.id).toBe(1);

    expect(decoded.email).toBe('test@example.com');
  });

  it('should read the expiry from JWT_EXPIRES_IN when set', () => {
    // Prova che la scadenza è davvero letta dall'ambiente e non hardcoded:
    // con un valore diverso da quello di default (1h), il token deve
    // riflettere ESATTAMENTE quella durata.
    process.env.JWT_EXPIRES_IN = '2h';

    const token = signToken({ id: 1 });

    const decoded = jwt.decode(token) as JwtPayload;

    expect(decoded.exp! - decoded.iat!).toBeCloseTo(7200, -1);
  });

  it('should fall back to DEFAULT_TOKEN_EXPIRES_IN (1 hour) when JWT_EXPIRES_IN is not set', () => {
    delete process.env.JWT_EXPIRES_IN;

    expect(DEFAULT_TOKEN_EXPIRES_IN).toBe('1h');

    const token = signToken({ id: 1 });

    const decoded = jwt.decode(token) as JwtPayload;

    expect(decoded.exp).toBeDefined();

    expect(decoded.exp! - decoded.iat!).toBeCloseTo(3600, -1);
  });

  it('should sign using JWT_SECRET from the environment', () => {
    const token = signToken({ id: 1 });

    // Con un secret diverso da quello usato per firmare, la verifica deve
    // fallire: conferma che il token dipende davvero da process.env.JWT_SECRET,
    // non da un valore hardcoded.
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});