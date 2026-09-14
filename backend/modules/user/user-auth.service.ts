import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';
import { normalizeEmail } from '../../services/emailNormalizer';
import { CredentialsService } from '../auth/credentials.service';
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
    // Un'email già registrata fa lanciare a Prisma un errore di vincolo
    // univoco, che arriva al filter come 500 generico: comportamento
    // conservato, decisione aperta come per i Customer.
    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: normalizeEmail(data.email),
        password: await this.credentials.hashPassword(data.password),
      },
    });

    return this.credentials.issueTokenFor(user, (id, token) =>
      this.saveCurrentToken(id, token)
    );
  }

  /**
   * @throws UnauthorizedException "Utente non trovato" o "Password errata"
   *   (da CredentialsService).
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
   * ATTENZIONE, comportamento legacy conservato: il cambio password NON
   * invalida il token corrente, quindi un JWT emesso prima del cambio resta
   * valido. Contraddice il pattern di invalidazione descritto in CLAUDE.md, e
   * docs/API.md lo elenca fra i problemi noti. La correzione cambia il
   * contratto (il client dovrebbe rifare login, o ricevere un nuovo token),
   * quindi è fra le decisioni aperte di F3 e non è stata applicata di
   * iniziativa.
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

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: await this.credentials.hashPassword(newPassword) },
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
