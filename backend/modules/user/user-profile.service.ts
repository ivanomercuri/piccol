import { Injectable } from '@nestjs/common';
import { PrismaClient, User } from '@prisma/client';
import { normalizeEmail } from '../../services/emailNormalizer';
import { rejectDuplicateEmail } from '../auth/duplicate-email';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Ciò che GET /admin/user restituisce: mai password né current_token. */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  level: User['level'];
}

/** Ciò che PATCH /admin/user restituisce: come il legacy, senza `level`. */
export type UpdatedUserProfile = Omit<UserProfile, 'level'>;

/**
 * Lettura e modifica del profilo dell'utente autenticato. Sostituisce
 * getProfileUser e updateProfileUser di profileUserController.ts.
 *
 * PERCHÉ UN SERVICE ANCHE PER LA SEMPLICE LETTURA
 * La riga User contiene l'hash della password e il token corrente. Decidere
 * quali campi escono verso il client è una scelta di sicurezza, non di
 * presentazione: un controller che restituisse direttamente la riga li
 * esporrebbe entrambi. Tenerla in un unico punto, coperto da un test, rende
 * quell'errore visibile.
 */
@Injectable()
export class UserProfileService {
  constructor(private readonly prisma: PrismaClient) {}

  getProfile(user: User): UserProfile {
    // Selezione esplicita dei campi pubblici invece di "togliere" quelli
    // riservati: se un giorno lo schema aggiungesse un campo sensibile (un
    // segreto 2FA, per esempio), qui non comparirebbe per errore.
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      level: user.level,
    };
  }

  async updateProfile(
    userId: number,
    data: UpdateProfileDto
  ): Promise<UpdatedUserProfile> {
    // Il legacy costruiva l'update solo con i campi presenti (`if (name)`),
    // ma la validazione li ha sempre resi obbligatori entrambi: la condizione
    // non poteva mai essere falsa. Qui si scrivono direttamente.
    //
    // L'email è normalizzata: è uno dei punti in cui un'email viene SCRITTA
    // (elenco in CLAUDE.md). Senza, un utente potrebbe salvarla con le
    // maiuscole e non riuscire più a fare login.
    //
    // Un'email già usata da un altro utente è lo stesso caso della
    // registrazione, e ha la stessa risposta: 409 (decisione A).
    const updated = await rejectDuplicateEmail(
      this.prisma.user.update({
        where: { id: userId },
        data: { name: data.name, email: normalizeEmail(data.email) },
      })
    );

    return { id: updated.id, name: updated.name, email: updated.email };
  }
}
