import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Body di PATCH /admin/user.
 *
 * Entrambi i campi sono obbligatori, come nella validazione legacy, anche se
 * per un PATCH ci si aspetterebbe un aggiornamento parziale (docs/API.md lo
 * segnala). Renderli opzionali cambierebbe il contratto: è una scelta da fare
 * esplicitamente, non un effetto collaterale della migrazione.
 *
 * Il formato dell'email è verificato come in registrazione (decisione D):
 * senza, un utente potrebbe sostituire la propria email valida con una
 * inservibile.
 */
export class UpdateProfileDto {
  @IsNotEmpty({ message: 'Nome è richiesto' })
  @IsString({ message: 'Nome deve essere un testo' })
  name!: string;

  @IsNotEmpty({ message: 'Email è richiesta' })
  @IsEmail({}, { message: 'Email non valida' })
  email!: string;
}
