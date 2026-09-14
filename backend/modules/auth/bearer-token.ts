import { ExtractJwt } from 'passport-jwt';

/**
 * Estrae il token da un header `Authorization: Bearer <token>`, oppure
 * restituisce null.
 *
 * Una sola istanza condivisa da JwtUserStrategy (che la usa per leggere il
 * token da verificare e per confrontarlo con current_token) e da
 * AuthUserGuard (che la usa per capire PERCHÉ una richiesta è stata
 * rifiutata). Se usassero due regole di estrazione diverse, il messaggio
 * d'errore potrebbe descrivere un problema diverso da quello reale.
 *
 * Differenza rispetto al middleware legacy, deliberata: authUserMiddleware
 * prendeva la seconda parola dell'header qualunque fosse la prima, quindi
 * accettava anche `Basic <token>` o `Token <token>`. Questo estrattore
 * pretende lo schema `Bearer` (senza distinzione fra maiuscole e minuscole),
 * come prescrive lo standard dei bearer token (RFC 6750). Un client che usa
 * lo schema corretto non vede differenze.
 */
export const extractBearerToken = ExtractJwt.fromAuthHeaderAsBearerToken();
