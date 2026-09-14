import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { extractBearerToken } from './bearer-token';
import { JWT_USER_STRATEGY } from './jwt-user.strategy';

/**
 * Protegge una rotta richiedendo un JWT valido di un User:
 *
 *   @UseGuards(AuthUserGuard)
 *
 * PER CHI VIENE DA SYMFONY
 * Un guard decide se una richiesta può raggiungere il controller, come
 * `access_control` o #[IsGranted]. Gira DOPO i middleware e PRIMA delle pipe
 * di validazione: una richiesta non autenticata riceve 401 senza che il suo
 * body venga nemmeno validato, come accadeva nella catena legacy.
 *
 * PERCHÉ SOVRASCRIVERE handleRequest
 * AuthGuard di @nestjs/passport risponde con un 401 generico
 * ("Unauthorized") a qualunque rifiuto. Il middleware legacy invece
 * distingueva cinque casi, e i client (e i test) contano su quei messaggi.
 * Due arrivano già pronti da JwtUserStrategy.validate() ("Utente non
 * trovato", "Token non più valido"); gli altri tre nascono PRIMA di
 * validate(), dentro passport, e vanno ricostruiti qui.
 */
@Injectable()
export class AuthUserGuard extends AuthGuard(JWT_USER_STRATEGY) {
  /**
   * Chiamato da @nestjs/passport con l'esito dell'autenticazione:
   * - `err`: un'eccezione lanciata da validate() (o un errore imprevisto,
   *   come il database irraggiungibile);
   * - `user`: ciò che validate() ha restituito, oppure false se passport ha
   *   rifiutato il token prima di chiamarla.
   */
  handleRequest<TUser>(
    err: unknown,
    user: unknown,
    _info: unknown,
    context: ExecutionContext
  ): TUser {
    // Rilanciato così com'è: i 401 di validate() hanno già il messaggio
    // giusto. Un errore imprevisto invece arriva al filter come 500. Il
    // middleware legacy lo avrebbe trasformato in un 401 "Token scaduto o non
    // valido": un database irraggiungibile sembrava un token sbagliato, e il
    // client avrebbe fatto logout invece di riprovare.
    if (err) {
      throw err;
    }

    if (user) {
      return user as TUser;
    }

    const request = context.switchToHttp().getRequest<Request>();

    throw new UnauthorizedException(rejectionReasonFor(request));
  }
}

/**
 * Ricostruisce perché passport ha rifiutato la richiesta, nell'ordine in cui
 * lo verificava il middleware legacy. passport-jwt comunica il motivo solo
 * come errore interno in inglese; ricavarlo dalla richiesta stessa, con lo
 * stesso estrattore usato dalla strategia, dà un risultato certo.
 */
function rejectionReasonFor(request: Request): string {
  if (!request.headers.authorization) {
    return 'Token mancante';
  }

  if (!extractBearerToken(request)) {
    return 'Formato token non valido';
  }

  // Il token c'era ed era leggibile: firma o scadenza non sono valide.
  return 'Token scaduto o non valido';
}
