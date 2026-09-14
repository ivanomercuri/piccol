// AuthUserGuard.handleRequest in isolamento: la traduzione dei rifiuti di
// passport nei messaggi del middleware legacy. Eredita i casi di
// authUserMiddleware.test.ts che riguardano l'header e il token.
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthUserGuard } from '../modules/auth/auth-user.guard';

describe('AuthUserGuard.handleRequest', () => {
  const guard = new AuthUserGuard();

  function contextWithAuthorization(authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
    } as unknown as ExecutionContext;
  }

  // Esito positivo: l'utente restituito da JwtUserStrategy passa invariato.
  it('restituisce l\'utente autenticato', () => {
    const user = { id: 1 };

    expect(guard.handleRequest(null, user, undefined, contextWithAuthorization('Bearer x'))).toBe(user);
  });

  // I 401 di validate() ("Utente non trovato", "Token non più valido") hanno
  // già il messaggio giusto e vanno rilanciati identici, non sostituiti.
  it('rilancia intatto l\'errore prodotto dalla strategia', () => {
    const fromStrategy = new UnauthorizedException('Token non più valido');

    expect(() =>
      guard.handleRequest(fromStrategy, false, undefined, contextWithAuthorization('Bearer x'))
    ).toThrow(fromStrategy);
  });

  // Anche un errore imprevisto (database irraggiungibile) passa intatto: così
  // arriva al filter come 500, invece di mascherarsi da token non valido come
  // accadeva nel middleware legacy.
  it('non trasforma un errore imprevisto in un 401', () => {
    const outage = new Error('connessione rifiutata');

    expect(() =>
      guard.handleRequest(outage, false, undefined, contextWithAuthorization('Bearer x'))
    ).toThrow(outage);
  });

  // I tre rifiuti che nascono dentro passport, prima di validate(): il
  // messaggio si ricava dalla richiesta, nello stesso ordine del legacy.
  it.each([
    [undefined, 'Token mancante'],
    ['Bearer', 'Formato token non valido'],
    ['abc', 'Formato token non valido'],
    // Cambio deliberato di F3: il legacy accettava qualunque schema,
    // lo standard (e passport-jwt) pretende Bearer.
    ['Basic abc.def.ghi', 'Formato token non valido'],
    ['Bearer abc.def.ghi', 'Token scaduto o non valido'],
  ])('con Authorization %p risponde "%s"', (authorization, expected) => {
    expect(() =>
      guard.handleRequest(null, false, undefined, contextWithAuthorization(authorization))
    ).toThrow(new UnauthorizedException(expected));
  });
});
