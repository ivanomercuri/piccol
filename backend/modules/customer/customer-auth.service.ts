import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../../services/emailNormalizer';
import { CredentialsService } from '../auth/credentials.service';
import { rejectDuplicateEmail } from '../auth/duplicate-email';
import { RegisterCustomerDto } from './dto/register-customer.dto';

/**
 * Registrazione e login dei clienti dello storefront. Sostituisce
 * authenticateCustomer (services/authService.ts) e registerCustomer
 * (services/registerService.ts).
 *
 * Customer e User restano due identità separate (CLAUDE.md, "due modelli di
 * identità paralleli"): questo service interroga solo la tabella customers.
 * La logica di sicurezza invece NON è duplicata: hash e confronto della
 * password, firma e salvataggio del token sono in CredentialsService,
 * condiviso con gli User (dalla fase F3; in F2 erano funzioni esportate da
 * services/).
 *
 * COSA CAMBIA RISPETTO ALLE FUNZIONI LEGACY
 * - Prisma arriva dal costruttore invece che da un import del singleton: la
 *   dipendenza è visibile, e nei test si sostituisce con un provider finto
 *   (vedi __tests__/customerAuthService.test.ts), senza jest.mock.
 * - Un login fallito LANCIA UnauthorizedException invece di restituire
 *   { success: false }. Il controller non deve più tradurre un esito in una
 *   risposta HTTP: l'eccezione arriva ad AllExceptionsFilter, che produce il
 *   401 nel formato del progetto (decisione D1).
 *
 * Nota di architettura: un service che lancia eccezioni HTTP è legato al
 * fatto di essere usato da un controller HTTP. È l'idioma di NestJS ed è
 * accettabile finché gli unici chiamanti sono controller, come qui.
 */
@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly credentials: CredentialsService
  ) {}

  /**
   * Registra un cliente e restituisce il suo JWT.
   *
   * CREAZIONE E TOKEN NELLA STESSA TRANSAZIONE (fase F6)
   * Il token contiene l'id del cliente, che esiste solo dopo l'INSERT: servono
   * quindi due scritture, la create e poi il salvataggio del token. Fino a F5
   * erano indipendenti, e se la seconda falliva il cliente restava registrato
   * senza token: il client riceveva un 500, e riprovando otteneva 409 "Email
   * già registrata" per un account che credeva di non aver creato.
   *
   * Qui serve una transazione INTERATTIVA (`$transaction(async (tx) => ...)`) e
   * non una create annidata come per i prodotti: fra le due scritture c'è
   * codice applicativo, la firma del token, che ha bisogno del risultato della
   * prima. Tutte le query passano da `tx`, non da `this.prisma`: una query
   * fatta con il client normale uscirebbe dalla transazione.
   *
   * L'hash della password resta fuori, prima: bcrypt impiega decine di
   * millisecondi, e una transazione tiene occupata una connessione del pool per
   * tutta la sua durata.
   */
  async register(data: RegisterCustomerDto): Promise<string> {
    // I campi sono mappati uno per uno, mai con uno spread del DTO: anche se
    // la ValidationPipe scarta i campi non dichiarati, questo è il punto in
    // cui si decide che cosa arriva al database, e deve restare leggibile.
    //
    // L'email è normalizzata in minuscolo: su PostgreSQL il vincolo UNIQUE è
    // case-sensitive (vedi services/emailNormalizer.ts).
    //
    // L'hash si calcola prima, fuori dalla scrittura: rejectDuplicateEmail
    // deve intercettare solo gli errori del database.
    const passwordHash = await this.credentials.hashPassword(data.password);

    // Email già registrata → 409 "Email già registrata" (decisione A, presa
    // in F3; fino ad allora era un 500 generico).
    //
    // Dentro la transazione, rejectDuplicateEmail funziona allo stesso modo: la
    // violazione del vincolo annulla la transazione, e l'eccezione tradotta
    // (409) esce da $transaction dopo il rollback.
    return this.prisma.$transaction(async (tx) => {
      const customer = await rejectDuplicateEmail(
        tx.customer.create({
          data: {
            email: normalizeEmail(data.email),
            password: passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
            address: data.address,
          },
        })
      );

      return this.credentials.issueTokenFor(customer, (id, token) =>
        this.saveCurrentToken(id, token, tx)
      );
    });
  }

  /**
   * Autentica un cliente e restituisce il suo JWT.
   *
   * @throws UnauthorizedException "Credenziali non valide" (da CredentialsService).
   */
  async login(email: string, password: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { email: normalizeEmail(email) },
    });

    return this.credentials.authenticate(customer, password, (id, token) =>
      this.saveCurrentToken(id, token)
    );
  }

  /**
   * Salva il token appena emesso come unico token valido del cliente: è ciò
   * che rende possibile invalidarlo in futuro (pattern di invalidazione in
   * CLAUDE.md). Estratto in un metodo perché registrazione e login lo usano
   * identico.
   *
   * `db` è il client con cui scrivere: quello della transazione durante la
   * registrazione, quello normale al login (una sola scrittura, nessuna
   * transazione da condividere).
   */
  private saveCurrentToken(
    customerId: number,
    token: string,
    db: Prisma.TransactionClient = this.prisma
  ): Promise<unknown> {
    return db.customer.update({
      where: { id: customerId },
      data: { current_token: token },
    });
  }
}
