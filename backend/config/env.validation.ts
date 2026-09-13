// Import esplicito, anche se "nell'app funzionerebbe lo stesso". Il
// decoratore @Type di class-transformer chiama Reflect.getMetadata, che non
// è JavaScript standard: lo aggiunge il polyfill reflect-metadata. Dentro
// l'app lo carica @nestjs/core prima di arrivare qui, quindi senza questa
// riga il modulo funzionerebbe solo grazie all'ORDINE degli import — una
// dipendenza nascosta. L'ha fatta emergere il suo test unitario, che carica
// questo file da solo e falliva con "Reflect.getMetadata is not a function".
import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/**
 * Contratto delle variabili d'ambiente che l'app richiede per partire.
 *
 * PERCHÉ UNA CLASSE CON DECORATORI E NON UN SEMPLICE ELENCO DI NOMI
 * È lo stesso idioma che i DTO useranno dalla fase F2 per validare i body
 * delle richieste (class-validator + class-transformer): una sola tecnica di
 * validazione nel progetto, invece di una per l'ambiente e una per l'input
 * HTTP. In più @Type(() => Number) converte PORT da stringa (tutto ciò che
 * arriva da process.env è stringa) a numero, quindi chi legge la
 * configurazione riceve già il tipo giusto.
 *
 * Il `!` dopo ogni proprietà ("definite assignment assertion") serve per
 * `strict: true`: TypeScript pretenderebbe che ogni proprietà venga
 * inizializzata nel costruttore, mentre qui i valori li scrive
 * plainToInstance a runtime. Il `!` dice al compilatore "fidati, arriva da
 * fuori" — ed è precisamente per questo che subito dopo si valida.
 *
 * COSA NON C'È, E PERCHÉ
 * - MAX_FILE_SIZE: dentro il container vale letteralmente "3# in MB", perché
 *   il parser env_file di Docker Compose non riconosce un commento in linea
 *   senza uno spazio prima del `#`. Il middleware legacy la legge con
 *   parseInt, che si ferma alla prima non-cifra e restituisce 3: funziona per
 *   caso. Validarla qui come numero impedirebbe all'app di partire. Entra in
 *   questo contratto in F4, quando la validazione degli upload passa a
 *   NestJS e il valore in .env sarà stato corretto.
 * - MAX_FILE_HARD_SIZE: nessun codice la legge (il limite hard è ancora
 *   scritto a mano in uploadMiddleware.ts).
 * - SHOW_ROUTES: la legge solo listRoutesController, destinato a sparire in
 *   F5 (decisione D8); in sua assenza la rotta resta disabilitata, che è il
 *   comportamento sicuro.
 * - Le porte pubblicate sull'host (BACKEND_HOST_PORT, ecc.): servono a
 *   docker-compose.yml, non all'app.
 */
class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN!: string;

  @IsString()
  @IsNotEmpty()
  DB_USER!: string;

  @IsString()
  @IsNotEmpty()
  DB_ROOT_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DB_HOST!: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME!: string;
}

/**
 * Funzione passata a ConfigModule.forRoot({ validate }). Riceve l'unione di
 * process.env (e dell'eventuale file .env) e deve restituire la
 * configurazione validata, oppure lanciare.
 *
 * Lancia UN solo errore che elenca TUTTE le variabili mancanti o non valide:
 * è il vantaggio rispetto ai controlli sparsi a livello di modulo
 * (tokenService.ts, databaseUrl.ts), che si fermano alla prima. Chi configura
 * l'ambiente scopre tutto in un solo tentativo di avvio invece che uno per
 * volta.
 *
 * Nota onesta sulla fase di transizione: finché i moduli legacy restano nel
 * grafo degli import, i loro controlli a livello di modulo scattano PRIMA di
 * questo (vengono eseguiti all'import, questo durante la costruzione del
 * modulo). Quindi per ora una variabile del database mancante produce ancora
 * il messaggio di databaseUrl.ts. La politica "nessun fallback" è rispettata
 * in entrambi i casi; l'elenco completo diventa il comportamento effettivo
 * man mano che i moduli legacy vengono migrati.
 */
export function validateEnvironment(
  config: Record<string, unknown>
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    // Ogni ValidationError ha `property` (il nome della variabile) e
    // `constraints`, un dizionario regola → messaggio. Li appiattiamo in una
    // riga leggibile per variabile.
    const details = errors
      .map(
        (error) =>
          `${error.property} (${Object.values(error.constraints ?? {}).join('; ')})`
      )
      .join(', ');

    throw new Error(
      `Missing or invalid environment variables in .env: ${details}`
    );
  }

  return validatedConfig;
}
