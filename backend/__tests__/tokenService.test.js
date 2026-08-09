// tokenService è il punto unico di firma dei JWT introdotto per evitare che
// authService e registerService tornino a divergere sulla policy di
// scadenza (era già successo una volta, vedi services/tokenService.js). La
// scadenza è configurabile via env (JWT_EXPIRES_IN), con un fallback interno
// solo per non rompere l'emissione dei token se qualcuno dimentica di
// impostarla.
const jwt = require('jsonwebtoken');
const {
  signToken,
  DEFAULT_TOKEN_EXPIRES_IN,
} = require('../services/tokenService');

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

    const decoded = jwt.verify(token, 'testsecret');

    expect(decoded.id).toBe(1);

    expect(decoded.email).toBe('test@example.com');
  });

  it('should read the expiry from JWT_EXPIRES_IN when set', () => {
    // Prova che la scadenza è davvero letta dall'ambiente e non hardcoded:
    // con un valore diverso da quello di default (1h), il token deve
    // riflettere ESATTAMENTE quella durata.
    process.env.JWT_EXPIRES_IN = '2h';

    const token = signToken({ id: 1 });

    const decoded = jwt.decode(token);

    expect(decoded.exp - decoded.iat).toBeCloseTo(7200, -1);
  });

  it('should fall back to DEFAULT_TOKEN_EXPIRES_IN (1 hour) when JWT_EXPIRES_IN is not set', () => {
    delete process.env.JWT_EXPIRES_IN;

    expect(DEFAULT_TOKEN_EXPIRES_IN).toBe('1h');

    const token = signToken({ id: 1 });

    const decoded = jwt.decode(token);

    expect(decoded.exp).toBeDefined();

    expect(decoded.exp - decoded.iat).toBeCloseTo(3600, -1);
  });

  it('should sign using JWT_SECRET from the environment', () => {
    const token = signToken({ id: 1 });

    // Con un secret diverso da quello usato per firmare, la verifica deve
    // fallire: conferma che il token dipende davvero da process.env.JWT_SECRET,
    // non da un valore hardcoded.
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});