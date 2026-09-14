// services/tokenService.ts dalla fase F3 contiene solo JWT_SECRET, usato
// dal middleware legacy dei prodotti fino a F4. I test sulla firma dei token
// (payload, scadenza secondo JWT_EXPIRES_IN, segreto reale) sono passati a
// __tests__/credentialsService.test.ts insieme alla responsabilità, e quello
// su JWT_EXPIRES_IN mancante a envValidation.test.ts, perché ora quella
// variabile la valida config/env.validation.ts.
//
// Resta il controllo all'import: finché il middleware legacy esiste, un
// JWT_SECRET mancante deve impedire all'app di caricarsi.
describe('tokenService', () => {
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
});
