import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient, User } from '@prisma/client';
import { AuthenticatedRequest } from './authenticated-request';
import { extractBearerToken } from './bearer-token';

/** Forma del payload firmato da CredentialsService.issueTokenFor. */
interface TokenPayload {
  id: unknown;
  email?: unknown;
}

/**
 * Protegge una rotta richiedendo un JWT valido di un User:
 *
 *   @UseGuards(AuthUserGuard)
 *
 * PER CHI VIENE DA SYMFONY
 * Un guard decide se una richiesta può raggiungere il controller, come
 * `access_control` o #[IsGranted]. Gira DOPO i middleware e PRIMA delle pipe
 * di validazione: una richiesta non autenticata riceve 401 senza che il suo
 * body venga nemmeno validato.
 *
 * PERCHÉ SCRITTO A MANO, E NON CON @nestjs/passport (fase F7)
 * Fino a F6 erano due classi: una strategia passport-jwt più un AuthUserGuard
 * che ereditava da AuthGuard e ricostruiva i messaggi d'errore, perché passport
 * risponde "Unauthorized" a qualunque rifiuto. Quel codice funziona anche su
 * Fastify (verificato), ma passport è una libreria di forma Express: aggiunge
 * metodi alle richieste di Express e i suoi tipi dipendono da @types/express.
 * Con l'obiettivo "zero Express" è stata rifatta a mano — ed è anche più
 * corta della somma delle due classi precedenti, perché i cinque messaggi
 * nascono dove nasce il rifiuto, invece di essere ricostruiti dopo. Ribalta la
 * decisione D3 (Design Decisions Log di AGENTS.md).
 *
 * I cinque messaggi del 401 e il loro ordine sono quelli di sempre, fissati nei
 * test end-to-end: non è cambiato niente per il client.
 */
@Injectable()
export class AuthUserGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaClient
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const token = this.readToken(request);

    const payload = await this.verifyToken(token);

    // L'utente autenticato viene scritto sulla richiesta, da dove lo legge il
    // decoratore @CurrentUser(). È lo stesso punto in cui lo scriveva
    // @nestjs/passport.
    request.user = await this.loadUser(payload, token);

    return true;
  }

  /**
   * Il token presente nell'header, o il rifiuto corrispondente.
   *
   * I due casi sono distinti di proposito: "Token mancante" quando l'header non
   * c'è, "Formato token non valido" quando c'è ma non è nella forma
   * `Bearer <token>`. Un client che sbaglia sa quale dei due errori ha fatto.
   */
  private readToken(request: AuthenticatedRequest): string {
    if (!request.headers.authorization) {
      throw new UnauthorizedException('Token mancante');
    }

    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Formato token non valido');
    }

    return token;
  }

  /**
   * Verifica firma e scadenza, e restituisce il payload.
   *
   * `algorithms: ['HS256']` è dichiarato esplicitamente: la libreria
   * accetterebbe qualunque algoritmo HMAC, e fissare quello con cui firmiamo
   * (modules/auth/auth.module.ts) chiude la porta agli attacchi di "confusione
   * dell'algoritmo", in cui chi attacca presenta un token firmato con un
   * algoritmo diverso da quello atteso. Il segreto non va passato: lo prende da
   * JwtModule, cioè dalla stessa configurazione usata per firmare.
   *
   * Qualunque errore di verifica (firma sbagliata, token scaduto, token
   * illeggibile) è un 401 con lo stesso messaggio: al client non serve sapere
   * quale dei tre, e distinguerli direbbe a chi attacca quanto si è avvicinato.
   */
  private async verifyToken(token: string): Promise<TokenPayload> {
    try {
      return await this.jwt.verifyAsync<TokenPayload>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Token scaduto o non valido');
    }
  }

  /**
   * Rilegge l'utente dal database e verifica che il token sia ancora quello
   * valido: è il cuore del pattern di invalidazione descritto in CLAUDE.md.
   *
   * Una firma valida non basta. Dopo il logout, o dopo un cambio password,
   * `current_token` è null o diverso, quindi un token rubato smette di
   * funzionare pur restando perfettamente firmato. Per questo serve il token
   * grezzo, non solo il payload: dal payload la stringa firmata non è
   * ricostruibile.
   *
   * Un errore del database non viene tradotto in 401: risale al filter come
   * 500. Il middleware legacy invece rispondeva "Token scaduto o non valido", e
   * il client faceva logout invece di riprovare.
   */
  private async loadUser(payload: TokenPayload, token: string): Promise<User> {
    // Difesa in più: solo token firmati con il nostro segreto arrivano qui, e
    // noi firmiamo sempre un id numerico. Senza questo controllo, un payload di
    // forma diversa farebbe fallire la query di Prisma con un 500 invece di un
    // 401.
    if (!Number.isInteger(payload.id)) {
      throw new UnauthorizedException('Token scaduto o non valido');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.id as number } });

    if (!user) {
      throw new UnauthorizedException('Utente non trovato');
    }

    if (user.current_token !== token) {
      throw new UnauthorizedException('Token non più valido');
    }

    return user;
  }
}
