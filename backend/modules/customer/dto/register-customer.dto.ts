import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * Body di POST /register. Sostituisce la catena di express-validator che
 * stava in routes/customerRoutes.ts.
 *
 * PER CHI VIENE DA PHP
 * È l'equivalente di una classe con gli attributi di Symfony Validator
 * (#[Assert\NotBlank], #[Assert\Email]): la ValidationPipe globale trasforma
 * il JSON in un'istanza di questa classe e ne verifica i vincoli PRIMA che il
 * controller venga eseguito. Se qualcosa non va, il controller non parte
 * nemmeno.
 *
 * Il `!` dopo ogni proprietà dice a TypeScript che il valore arriva da fuori
 * (lo assegna la ValidationPipe), non dal costruttore: senza, `strict: true`
 * lo segnalerebbe come proprietà mai inizializzata.
 *
 * Differenze rispetto alle regole legacy, tutte a favore del client:
 * - @IsString sui campi testuali. Prima un valore non stringa (es.
 *   "password": 123) superava la validazione e faceva esplodere il codice
 *   più avanti con un 500; ora è un 400 con un messaggio chiaro.
 * - Corretti i messaggi "Nome è richiesta" e "Cognome è richiesta".
 * - I campi non dichiarati qui vengono SCARTATI (`whitelist: true` nella
 *   ValidationPipe): un client che invia anche `id` o `current_token` non
 *   può farli arrivare al database. È una difesa in più: il service mappa
 *   comunque i campi uno per uno.
 *
 * L'ordine delle proprietà è quello in cui gli errori compaiono nella
 * risposta. L'ordine dei decoratori su una stessa proprietà invece NON conta:
 * vedi common/validation/validation-exception.factory.ts.
 */
export class RegisterCustomerDto {
  @IsNotEmpty({ message: 'Email è richiesta' })
  @IsEmail({}, { message: 'Email non valida' })
  email!: string;

  @IsNotEmpty({ message: 'Password è richiesta' })
  @IsString({ message: 'Password deve essere un testo' })
  password!: string;

  @IsNotEmpty({ message: 'Nome è richiesto' })
  @IsString({ message: 'Nome deve essere un testo' })
  firstName!: string;

  @IsNotEmpty({ message: 'Cognome è richiesto' })
  @IsString({ message: 'Cognome deve essere un testo' })
  lastName!: string;

  // Obbligatorio per la rotta, come nella validazione legacy, anche se la
  // colonna `address` nello schema ammette null.
  @IsNotEmpty({ message: 'Indirizzo è richiesto' })
  @IsString({ message: 'Indirizzo deve essere un testo' })
  address!: string;
}
