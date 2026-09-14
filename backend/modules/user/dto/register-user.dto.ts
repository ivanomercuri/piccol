import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body di POST /admin/user/register. Sostituisce la catena di
 * express-validator di routes/userRoutes.ts.
 *
 * `level` non è un campo accettato: ogni User nasce `admin` (default dello
 * schema). Grazie a `whitelist: true` nella ValidationPipe, un client che
 * inviasse `"level": "superadmin"` se lo vedrebbe scartare prima di arrivare
 * al service — oltre al fatto che il service mappa i campi uno per uno.
 *
 * A differenza del Customer, qui NON c'è @IsEmail: la validazione legacy
 * degli User non controllava il formato dell'email, e aggiungerlo
 * cambierebbe il contratto (un'email malformata oggi viene accettata). È
 * segnalato fra le decisioni aperte di F3 in docs/MIGRAZIONE-NESTJS.md.
 */
export class RegisterUserDto {
  @IsNotEmpty({ message: 'Nome è richiesto' })
  @IsString({ message: 'Nome deve essere un testo' })
  name!: string;

  @IsNotEmpty({ message: 'Email è richiesta' })
  @IsString({ message: 'Email deve essere un testo' })
  email!: string;

  @IsNotEmpty({ message: 'Password è richiesta' })
  @IsString({ message: 'Password deve essere un testo' })
  password!: string;
}
