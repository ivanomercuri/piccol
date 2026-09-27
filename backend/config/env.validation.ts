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
 * MAX_FILE_SIZE e MAX_FILE_HARD_SIZE sono entrate nel contratto in F4. Fino a
 * F3 il middleware legacy leggeva MAX_FILE_SIZE con parseInt, che dal valore
 * "3# in MB" (un commento in linea che il parser env_file di Docker Compose
 * non riconosce) estraeva 3 per caso; MAX_FILE_HARD_SIZE non la leggeva
 * nessuno, perché il limite hard era scritto a mano. Ora sono numeri interi
 * validati, e un valore come "3# in MB" impedisce all'app di partire con un
 * messaggio chiaro.
 *
 * COSA NON C'È, E PERCHÉ
 *  * - Le porte pubblicate sull'host (BACKEND_HOST_PORT, ecc.): servono a
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

  // Limite "di business" per le immagini dei prodotti, in MB: oltre, la
  // risposta è un errore di validazione con messaggio per il client.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_FILE_SIZE!: number;

  // Limite "hard" di multer, in MB: oltre, l'upload viene interrotto mentre
  // arriva, senza scrivere il file su disco. È una protezione del server, non
  // una regola di dominio.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_FILE_HARD_SIZE!: number;
}

/**
 * Funzione passata a ConfigModule.forRoot({ validate }). Riceve l'unione di
 * process.env (e dell'eventuale file .env) e deve restituire la
 * configurazione validata, oppure lanciare.
 *
 * Lancia UN solo errore che elenca TUTTE le variabili mancanti o non valide:
 * è il vantaggio rispetto ai controlli sparsi a livello di modulo (come
 * quelli di tokenService.ts e databaseUrl.ts), che si fermano alla prima.
 * Chi configura l'ambiente scopre tutto in un solo tentativo di avvio invece
 * che uno per volta.
 *
 * Eccezione nota, ed è permanente: databaseUrl.ts ha un proprio controllo,
 * che scatta PRIMA di questo. prisma/client.ts compone la stringa di
 * connessione all'import (questa funzione gira invece durante la costruzione
 * del modulo), e databaseUrl.ts deve bastare a sé stesso perché lo usa anche
 * prisma.config.ts, eseguito dalla CLI di Prisma fuori dall'app. Quindi una
 * variabile del database mancante produce il messaggio di databaseUrl.ts.
 * La politica "nessun fallback" è rispettata in entrambi i casi.
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

  // Regola che coinvolge due variabili, quindi fuori dai decoratori, che
  // guardano un campo alla volta. Se il limite di business superasse quello
  // hard, multer interromperebbe l'upload prima che il limite di business
  // possa mai scattare: il messaggio chiaro al client non comparirebbe mai, e
  // la configurazione sembrerebbe funzionare mentre non fa ciò che dichiara.
  if (validatedConfig.MAX_FILE_SIZE > validatedConfig.MAX_FILE_HARD_SIZE) {
    throw new Error(
      'Invalid environment variables in .env: MAX_FILE_SIZE must not exceed MAX_FILE_HARD_SIZE'
    );
  }

  return validatedConfig;
}
