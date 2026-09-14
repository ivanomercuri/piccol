import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PrismaClient, User } from '@prisma/client';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { extractBearerToken } from './bearer-token';

/**
 * Nome con cui la strategia viene registrata in passport, e con cui
 * AuthUserGuard la richiama. È esplicito ("jwt-user" e non il default "jwt")
 * perché le identità sono due: se un giorno servirà proteggere delle rotte
 * dei Customer, avranno una propria strategia "jwt-customer" che legge la
 * propria tabella, invece di una strategia unica che deve indovinare chi è.
 */
export const JWT_USER_STRATEGY = 'jwt-user';

/** Forma del payload firmato da CredentialsService.issueTokenFor. */
interface TokenPayload {
  id: unknown;
  email?: unknown;
}

/**
 * Autenticazione degli User tramite JWT, con @nestjs/passport e passport-jwt
 * (decisione D3). Sostituisce middlewares/authUserMiddleware.ts per le rotte
 * migrate a NestJS; il middleware resta finché lo usano le rotte legacy dei
 * prodotti (fino a F4).
 *
 * COME SI DIVIDONO IL LAVORO
 * - passport-jwt estrae il token dall'header e ne verifica firma e scadenza.
 *   Se falliscono, validate() non viene nemmeno chiamato.
 * - validate() fa la parte specifica del progetto: rilegge l'utente dal
 *   database e controlla che il token sia ancora quello valido.
 * - AuthUserGuard trasforma ogni rifiuto in un 401 con il messaggio giusto.
 *
 * PER CHI VIENE DA SYMFONY
 * È l'equivalente di un Authenticator del componente Security: estrae le
 * credenziali dalla richiesta e restituisce l'utente, o rifiuta.
 */
@Injectable()
export class JwtUserStrategy extends PassportStrategy(Strategy, JWT_USER_STRATEGY) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaClient
  ) {
    super({
      jwtFromRequest: extractBearerToken,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      // Algoritmo dichiarato esplicitamente: la libreria accetterebbe
      // qualunque algoritmo HMAC. Fissare quello con cui firmiamo chiude la
      // porta agli attacchi di "confusione dell'algoritmo", in cui chi
      // attacca presenta un token firmato con un algoritmo diverso da quello
      // atteso. Difesa in più, a costo zero.
      algorithms: ['HS256'],
      // IL PUNTO DELICATO DI D3 (§4.2 di docs/MIGRAZIONE-NESTJS.md).
      // Senza questo flag validate() riceverebbe solo il payload già
      // decodificato, e dal payload il token originale non si può
      // ricostruire. Il confronto con current_token diventerebbe impossibile,
      // e un token revocato al logout continuerebbe a essere accettato perché
      // la sua firma è valida. È verificato da un test end-to-end in
      // __tests__/userRoutes.test.ts.
      passReqToCallback: true,
    });
  }

  /**
   * Chiamato da passport solo dopo che firma e scadenza sono state
   * verificate. Ciò che restituisce diventa `request.user`, letto poi dal
   * decoratore @CurrentUser().
   *
   * @throws UnauthorizedException con gli stessi messaggi del middleware
   *   legacy. AuthUserGuard li lascia passare intatti.
   */
  async validate(request: Request, payload: TokenPayload): Promise<User> {
    // Difesa in più: solo token firmati con il nostro segreto arrivano qui, e
    // noi firmiamo sempre un id numerico. Senza questo controllo, un payload
    // di forma diversa farebbe fallire la query di Prisma con un 500 invece
    // di un 401.
    if (!Number.isInteger(payload.id)) {
      throw new UnauthorizedException('Token scaduto o non valido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.id as number },
    });

    if (!user) {
      throw new UnauthorizedException('Utente non trovato');
    }

    // Il cuore del pattern di invalidazione (CLAUDE.md): una firma valida non
    // basta, il token deve essere l'ultimo emesso per questo utente. Dopo il
    // logout current_token è null, quindi nessun token corrisponde.
    if (user.current_token !== extractBearerToken(request)) {
      throw new UnauthorizedException('Token non più valido');
    }

    return user;
  }
}
