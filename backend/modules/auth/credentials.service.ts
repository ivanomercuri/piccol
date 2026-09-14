import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

/**
 * Costo di bcrypt: 2^10 iterazioni. Prima il numero 10 era scritto a mano in
 * tre punti diversi (registrazione User, registrazione Customer, cambio
 * password): cambiarlo in uno solo avrebbe prodotto hash di robustezza
 * diversa a seconda del flusso, senza nessun segnale.
 */
const BCRYPT_ROUNDS = 10;

/**
 * Unico messaggio per ogni login fallito (decisione B, fase F3).
 *
 * Prima "Utente non trovato" e "Password errata" dicevano a chiunque quali
 * email corrispondono a un account: il primo passo di un attacco con
 * credenziali rubate altrove, che si concentra sugli account esistenti.
 */
const INVALID_CREDENTIALS = 'Credenziali non valide';

/** Ciò che serve per autenticare un'entità: sia User sia Customer lo soddisfano. */
export interface AuthenticatableEntity {
  id: number;
  email: string;
  password: string;
}

/**
 * Salva su un'entità il token appena emesso (o `null` per invalidarlo).
 * Riceve l'id invece di chiuderlo in una closure: chi chiama può passare il
 * metodo del proprio service senza preoccuparsi che l'entità esista già nel
 * momento in cui scrive la funzione.
 */
export type PersistToken = (entityId: number, token: string) => Promise<unknown>;

/**
 * Logica di sicurezza condivisa dalle due identità, User e Customer.
 *
 * Sostituisce, dalla fase F3 della migrazione a NestJS:
 * - completeAuthentication (services/authService.ts),
 * - issueTokenFor (services/registerService.ts),
 * - signToken (services/tokenService.ts),
 * - le chiamate dirette a bcrypt sparse nei service e nei controller.
 * In F2 erano funzioni esportate, perché le usavano sia il codice legacy di
 * User sia il service NestJS di Customer. Ora che anche User è migrato, tutti
 * i chiamanti sono provider NestJS, e la logica può diventare a sua volta un
 * provider: le dipendenze (il firmatario dei JWT, e attraverso di lui segreto
 * e scadenza) arrivano dal container invece che da letture di process.env
 * al momento dell'import.
 *
 * Resta valida la regola di CLAUDE.md: a essere condivisa è la logica di
 * sicurezza, non la query. Il service di ogni identità legge la propria
 * tabella e passa qui l'entità già letta.
 *
 * È anche il punto UNICO dove vive il messaggio del 401 di login, per
 * entrambe le identità insieme.
 */
@Injectable()
export class CredentialsService {
  /**
   * Hash di una password casuale che nessuno conosce, calcolato alla prima
   * richiesta di login per un account inesistente e poi riusato. Vedi
   * authenticate(). Stato dell'istanza e non del modulo: il provider è unico
   * nell'app, e non esiste un valore globale modificabile.
   */
  private unknownAccountHash?: Promise<string>;

  constructor(private readonly jwt: JwtService) {}

  hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  }

  /**
   * bcrypt.compare invece di confrontare due hash: lo stesso testo produce
   * hash diversi a ogni hashPassword (bcrypt incorpora un sale casuale),
   * quindi l'unico modo di verificare è ricalcolare con il sale memorizzato.
   */
  passwordMatches(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  /**
   * Verifica le credenziali di un'entità già cercata per email, e se sono
   * corrette emette e salva il suo token.
   *
   * Accetta `null` di proposito: il "non trovato" è parte dell'esito
   * dell'autenticazione, e gestirlo qui evita che ogni service di identità
   * ripeta lo stesso controllo.
   *
   * Lancia invece di restituire { success: false }: in F2 l'esito era
   * un'unione discriminata perché il codice legacy di User doveva tradurlo in
   * res.error. Ora nessun chiamante ha bisogno di un codice di ritorno, e
   * l'eccezione arriva da sola ad AllExceptionsFilter.
   *
   * STESSO MESSAGGIO E STESSO TEMPO, che l'account esista o no
   * Un messaggio unico non basta a nascondere quali email sono registrate. Se
   * per un'email sconosciuta si rispondesse subito, mentre per una conosciuta
   * si eseguisse bcrypt (decine di millisecondi, di proposito lento), la
   * DURATA della risposta rivelerebbe ciò che il messaggio nasconde. Per
   * questo, se l'account non esiste, si confronta comunque la password con un
   * hash fittizio: il lavoro è lo stesso in entrambi i casi.
   *
   * @throws UnauthorizedException "Credenziali non valide". Nessun token
   *   viene salvato: un tentativo fallito non deve invalidare la sessione del
   *   titolare legittimo dell'account.
   */
  async authenticate(
    entity: AuthenticatableEntity | null,
    plainPassword: string,
    persistToken: PersistToken
  ): Promise<string> {
    const passwordHash = entity?.password ?? (await this.hashForUnknownAccount());

    const passwordIsCorrect = await this.passwordMatches(plainPassword, passwordHash);

    if (!entity || !passwordIsCorrect) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.issueTokenFor(entity, persistToken);
  }

  /**
   * Firma un token per l'entità e lo salva come suo unico token valido: è ciò
   * che rende possibile invalidarlo al logout (pattern di invalidazione in
   * CLAUDE.md).
   *
   * Il payload è sempre { id, email }. Segreto, algoritmo e scadenza non
   * compaiono qui: sono configurati una volta sola in AuthModule, e
   * JwtService li applica a ogni firma.
   */
  async issueTokenFor(
    entity: { id: number; email: string },
    persistToken: PersistToken
  ): Promise<string> {
    const token = await this.jwt.signAsync({ id: entity.id, email: entity.email });

    await persistToken(entity.id, token);

    return token;
  }

  /**
   * L'hash fittizio usato per gli account inesistenti, calcolato una volta sola.
   * `??=` assegna solo se il campo è ancora undefined: dalla seconda chiamata
   * in poi si riusa la stessa Promise, già risolta. Lo stesso costo
   * (BCRYPT_ROUNDS) degli hash veri è ciò che rende uguali i tempi.
   */
  private hashForUnknownAccount(): Promise<string> {
    this.unknownAccountHash ??= bcrypt.hash(randomUUID(), BCRYPT_ROUNDS);

    return this.unknownAccountHash;
  }
}
