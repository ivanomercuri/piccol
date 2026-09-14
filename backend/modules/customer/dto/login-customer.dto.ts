import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body di POST /login.
 *
 * Come nella validazione legacy, qui non si controlla il FORMATO dell'email:
 * un'email malformata semplicemente non corrisponde a nessun cliente e
 * produce il 401 "Utente non trovato". Aggiungere @IsEmail trasformerebbe
 * quel 401 in un 400, cambiando il contratto.
 *
 * @IsString invece è nuovo, e corregge un bug: con `"email": 123` il login
 * legacy chiamava toLowerCase() su un numero, esplodeva con un TypeError e
 * rispondeva 500. Ora è un 400.
 */
export class LoginCustomerDto {
  @IsNotEmpty({ message: 'Email è richiesta' })
  @IsString({ message: 'Email deve essere un testo' })
  email!: string;

  @IsNotEmpty({ message: 'Password è richiesta' })
  @IsString({ message: 'Password deve essere un testo' })
  password!: string;
}
