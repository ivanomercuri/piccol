import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';
import { normalizeEmail } from '../../services/emailNormalizer';
import { CredentialsService } from '../auth/credentials.service';
import { rejectDuplicateEmail } from '../auth/duplicate-email';
import { RegisterUserDto } from './dto/register-user.dto';

/**
 * Credenziali e sessione degli utenti interni/admin: registrazione, login,
 * cambio password, logout.
 *
 * Sostituisce authenticateUser (services/authService.ts), registerUser
 * (services/registerService.ts) e i metodi changePassword e logout di
 * controllers/user/profileUserController.ts. Questi ultimi contenevano
 * logica — confronto e hash della password — dentro un controller, contro
 * la regola di AGENTS.md: qui tornano nel livello dei service.
 *
 * Interroga solo la tabella users. La logica di sicurezza (bcrypt, firma e
 * salvataggio del token) è in CredentialsService, condivisa con i Customer.
 */
@Injectable()
export class UserAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly credentials: CredentialsService
  ) {}

  /** Registra un utente (sempre con level `admin`, default dello schema) e restituisce il suo JWT. */
  async register(data: RegisterUserDto): Promise<string> {
    // Campi mappati uno per uno: è qui che si decide che cosa arriva al
    // database. L'email è normalizzata in minuscolo (services/emailNormalizer.ts).
    //
    // L'hash si calcola prima, fuori dalla scrittura: rejectDuplicateEmail
    // deve intercettare solo gli errori del database.
    const passwordHash = await this.credentials.hashPassword(data.password);

    // Email già registrata → 409 "Email già registrata" (decisione A).
    const user = await rejectDuplicateEmail(
      this.prisma.user.create({
        data: {
          name: data.name,
          email: normalizeEmail(data.email),
          password: passwordHash,
        },
      })
    );

    return this.credentials.issueTokenFor(user, (id, token) =>
      this.saveCurrentToken(id, token)
    );
  }

  /**
   * @throws UnauthorizedException "Credenziali non valide" (da CredentialsService).
   */
  async login(email: string, password: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });

    return this.credentials.authenticate(user, password, (id, token) =>
      this.saveCurrentToken(id, token)
    );
  }

  /**
   * Cambia la password dell'utente autenticato, dopo aver verificato quella
   * attuale.
   *
   * Riceve l'utente già letto da JwtUserStrategy all'inizio della richiesta,
   * con il suo hash corrente: non serve una seconda lettura dal database.
   *
   * INVALIDA IL TOKEN CORRENTE (decisione C, fase F3). Fino a F3 il cambio
   * password lasciava valido il JWT già emesso: chi aveva rubato un token
   * restava dentro anche dopo che la vittima aveva cambiato password, che è
   * proprio la reazione di chi sospetta un furto. Ora il client deve rifare
   * login con la nuova password, come dopo un logout — è il pattern di
   * invalidazione che CLAUDE.md descrive come intenzionale.
   *
   * @throws BadRequestException "La vecchia password non corrisponde".
   *   Un 400, come nel legacy, e non un 401: l'utente è autenticato, è il
   *   dato inviato a essere sbagliato.
   */
  async changePassword(
    user: User,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    if (!(await this.credentials.passwordMatches(oldPassword, user.password))) {
      throw new BadRequestException('La vecchia password non corrisponde');
    }

    const passwordHash = await this.credentials.hashPassword(newPassword);

    // Nuova password e azzeramento del token nella STESSA query: sono
    // un'unica modifica atomica. Con due query separate, un errore fra la
    // prima e la seconda lascerebbe la password cambiata e il vecchio token
    // ancora valido, cioè esattamente il problema che si vuole chiudere.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, current_token: null },
    });
  }

  /**
   * Invalida il token dell'utente: da questo momento JwtUserStrategy rifiuta
   * qualunque token gli sia stato emesso, con "Token non più valido".
   */
  async logout(userId: number): Promise<void> {
    await this.saveCurrentToken(userId, null);
  }

  /**
   * Scrive l'unico token valido dell'utente, o `null` per non averne nessuno.
   * Usato da registrazione, login e logout: un solo punto che tocca
   * current_token.
   */
  private saveCurrentToken(userId: number, token: string | null): Promise<unknown> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { current_token: token },
    });
  }
}
