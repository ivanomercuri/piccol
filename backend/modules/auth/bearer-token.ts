/** Schema richiesto dall'header Authorization, senza distinzione di maiuscole. */
const BEARER_SCHEME = /^Bearer (.+)$/i;

/**
 * Estrae il token da un header `Authorization: Bearer <token>`, oppure
 * restituisce null.
 *
 * PERCHÉ RICEVE L'HEADER E NON LA RICHIESTA
 * La funzione non conosce né Express né Fastify: riceve una stringa. È usata
 * da AuthUserGuard, che legge l'header dalla richiesta della piattaforma in
 * uso, e questo la rende verificabile con un test che non ha bisogno di
 * costruire una finta richiesta HTTP. Fino alla fase F7 era invece
 * `ExtractJwt.fromAuthHeaderAsBearerToken()` di passport-jwt, che riceveva la
 * richiesta e dipendeva dalla forma di quella di Express.
 *
 * Differenza rispetto al middleware legacy, deliberata: authUserMiddleware
 * prendeva la seconda parola dell'header qualunque fosse la prima, quindi
 * accettava anche `Basic <token>` o `Token <token>`. Qui lo schema `Bearer` è
 * obbligatorio, come prescrive lo standard dei bearer token (RFC 6750). Un
 * client che usa lo schema corretto non vede differenze.
 */
export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = BEARER_SCHEME.exec(authorizationHeader);

  return match ? match[1] : null;
}
