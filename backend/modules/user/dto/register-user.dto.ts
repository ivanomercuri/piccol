import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Body di POST /admin/user/register. Sostituisce la catena di
 * express-validator di routes/userRoutes.ts.
 *
 * `level` non è un campo accettato: ogni User nasce `admin` (default dello
 * schema). Grazie a `whitelist: true` nella ValidationPipe, un client che
 * inviasse `"level": "superadmin"` se lo vedrebbe scartare prima di arrivare
 * al service — oltre al fatto che il service mappa i campi uno per uno.
 *
 * Il formato dell'email è verificato come per i Customer (decisione D, fase
 * F3). Prima un utente poteva registrarsi con "abc" come email: un account
 * senza un indirizzo a cui scrivere, e un'incoerenza fra le due identità.
 */
export class RegisterUserDto {
  @IsNotEmpty({ message: 'Nome è richiesto' })
  @IsString({ message: 'Nome deve essere un testo' })
  name!: string;

  @IsNotEmpty({ message: 'Email è richiesta' })
  @IsEmail({}, { message: 'Email non valida' })
  email!: string;

  @IsNotEmpty({ message: 'Password è richiesta' })
  @IsString({ message: 'Password deve essere un testo' })
  password!: string;
}
