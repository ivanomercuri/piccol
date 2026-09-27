import type { NestApplicationOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import multipart from '@fastify/multipart';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdir } from 'fs/promises';
import { registerJsonContentTypeParser } from './common/middleware/json-content-type-parser';
import { megabytesToBytes } from './modules/product/upload/product-image.validator';
import { TEMP_UPLOADS_DIR } from './modules/product/upload/uploaded-files';

/**
 * Punto unico in cui si configura l'app NestJS, usato sia da main.ts sia dai
 * test end-to-end (__tests__/helpers/useTestApp.ts).
 *
 * PERCHÉ UN FILE CONDIVISO
 * È un errore classico dei progetti NestJS: main.ts configura l'app (pipe,
 * plugin, CORS) e i test costruiscono la loro app senza quella
 * configurazione, quindi verificano un'applicazione diversa da quella che
 * gira davvero. Con una sola funzione chiamata da entrambi, i test
 * attraversano esattamente la stessa catena della produzione.
 */

/**
 * Opzioni di creazione dell'app.
 *
 * `bodyParser: false` disattiva il parser JSON che NestJS registrerebbe da sé.
 * Il progetto ne installa uno proprio (json-content-type-parser.ts) per
 * conservare il messaggio "errore json: ..." del contratto API; con entrambi,
 * Fastify rifiuta l'avvio perché un tipo di contenuto può avere un solo parser
 * ("Content type parser 'application/json' already present", verificato).
 */
export const NEST_APP_OPTIONS: NestApplicationOptions = { bodyParser: false };

/**
 * Configura l'istanza Fastify che sta sotto l'app NestJS: CORS, parser JSON e
 * lettura dei body multipart.
 *
 * VA CHIAMATA PRIMA DI app.init() (o di app.listen(), che lo esegue), ed è
 * asincrona perché `register` di Fastify lo è: un plugin registrato dopo
 * l'avvio verrebbe rifiutato ("Fastify instance is already listening").
 *
 * DALLA FASE F7 NON CI SONO PIÙ MIDDLEWARE
 * Fino a F6 questa funzione montava, nell'ordine, responseFormatter (fino a
 * F5), CORS, express.json() e la traduzione degli errori JSON, perché l'app
 * girava sull'adapter Express. Con Fastify le stesse tre esigenze si
 * soddisfano con configurazione dell'istanza e plugin: nessun `app.use`.
 */
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  // Stesso comportamento del vecchio app.use(cors()): nessuna opzione, quindi
  // tutte le origini ammesse. enableCors è API di NestJS e vale su qualunque
  // piattaforma: sotto usa @fastify/cors invece del pacchetto cors.
  app.enableCors();

  const fastify = app.getHttpAdapter().getInstance();

  registerJsonContentTypeParser(fastify);

  // Lettura dei body multipart (l'upload delle immagini dei prodotti). Il
  // limite è quello hard: oltre quel peso la richiesta viene interrotta mentre
  // arriva, senza che il file venga scritto per intero.
  //
  // Il limite arriva da ConfigService, quindi già validato come intero da
  // config/env.validation.ts: il container esiste, perché questa funzione gira
  // dopo NestFactory.create.
  const hardLimitMegabytes = app.get(ConfigService).getOrThrow<number>('MAX_FILE_HARD_SIZE');

  await app.register(multipart, {
    limits: { fileSize: megabytesToBytes(hardLimitMegabytes) },
  });

  // La cartella dei file temporanei dell'upload: @fastify/multipart ci scrive
  // dentro ma non la crea (verificato nel sorgente del plugin).
  await mkdir(TEMP_UPLOADS_DIR, { recursive: true });
}
