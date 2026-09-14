import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../../services/emailNormalizer';
import { CredentialsService } from '../auth/credentials.service';
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

  /** Registra un cliente e restituisce il suo JWT. */
  async register(data: RegisterCustomerDto): Promise<string> {
    // I campi sono mappati uno per uno, mai con uno spread del DTO: anche se
    // la ValidationPipe scarta i campi non dichiarati, questo è il punto in
    // cui si decide che cosa arriva al database, e deve restare leggibile.
    //
    // L'email è normalizzata in minuscolo: su PostgreSQL il vincolo UNIQUE è
    // case-sensitive (vedi services/emailNormalizer.ts).
    //
    // Se l'email esiste già, Prisma lancia un errore di vincolo univoco che
    // arriva al filter come errore imprevisto: 500 con messaggio generico.
    // È il comportamento conservato dalla versione legacy; la scelta di un
    // 409 dedicato è una decisione aperta (docs/MIGRAZIONE-NESTJS.md, F2).
    const customer = await this.prisma.customer.create({
      data: {
        email: normalizeEmail(data.email),
        password: await this.credentials.hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName,
        address: data.address,
      },
    });

    return this.credentials.issueTokenFor(customer, (id, token) =>
      this.saveCurrentToken(id, token)
    );
  }

  /**
   * Autentica un cliente e restituisce il suo JWT.
   *
   * @throws UnauthorizedException "Utente non trovato" o "Password errata",
   *   gli stessi messaggi della versione legacy (da CredentialsService).
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
   */
  private saveCurrentToken(customerId: number, token: string): Promise<unknown> {
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { current_token: token },
    });
  }
}
