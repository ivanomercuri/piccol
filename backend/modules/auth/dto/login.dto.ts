import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Body del login, uguale per le due identità: POST /login (Customer) e
 * POST /admin/user/login (User).
 *
 * Condiviso invece di duplicato: la regola dei "due modelli di identità
 * paralleli" (CLAUDE.md) riguarda tabelle, query e token, non la forma di una
 * richiesta. Se un giorno il login di un'identità richiedesse campi diversi
 * (es. un codice 2FA solo per gli User), avrà un DTO proprio.
 *
 * Come nella validazione legacy, qui non si controlla il FORMATO dell'email:
 * un'email malformata semplicemente non corrisponde a nessun account e
 * produce il 401 "Utente non trovato". Aggiungere @IsEmail trasformerebbe
 * quel 401 in un 400, cambiando il contratto.
 *
 * @IsString invece corregge un bug del legacy: con `"email": 123` il login
 * chiamava toLowerCase() su un numero, esplodeva con un TypeError e
 * rispondeva 500. Ora è un 400.
 */
export class LoginDto {
  @IsNotEmpty({ message: 'Email è richiesta' })
  @IsString({ message: 'Email deve essere un testo' })
  email!: string;

  @IsNotEmpty({ message: 'Password è richiesta' })
  @IsString({ message: 'Password deve essere un testo' })
  password!: string;
}
