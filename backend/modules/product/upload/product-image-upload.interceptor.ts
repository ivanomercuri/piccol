import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { stat } from 'fs/promises';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';
import { RawNewProductForm } from './new-product-form';
import { discardUploadedFiles, TEMP_UPLOADS_DIR, UploadedImage } from './uploaded-files';

/** Campo multipart da cui arrivano le immagini, come nella rotta legacy. */
export const PRODUCT_IMAGE_FIELD = 'image';

/**
 * Codici d'errore di @fastify/multipart e di Fastify che sono colpa del client.
 * Il primo è il superamento del limite hard; gli altri riguardano un corpo
 * multipart malformato o mandato dove non è previsto.
 */
const FILE_TOO_LARGE_CODE = 'FST_REQ_FILE_TOO_LARGE';

const CLIENT_MULTIPART_ERROR_CODES = [
  'FST_PARTS_LIMIT',
  'FST_FILES_LIMIT',
  'FST_FIELDS_LIMIT',
  'FST_INVALID_MULTIPART_CONTENT_TYPE',
  'FST_PROTO_VIOLATION',
  'FST_ERR_CTP_INVALID_MEDIA_TYPE',
];

/**
 * Riceve le immagini di un nuovo prodotto e ne gestisce il ciclo di vita su
 * disco fino a quando la richiesta si conclude.
 *
 * COSA FA, IN ORDINE
 * 1. legge il corpo multipart e scrive i file in TEMP_UPLOADS_DIR;
 * 2. mette campi e immagini sulla richiesta, dove li legge @NewProductFormData;
 * 3. se qualcosa a valle fallisce (validazione, service), cancella i file.
 *
 * PERCHÉ LA CANCELLAZIONE STA QUI
 * Chi crea i file temporanei è responsabile di rimuoverli. Funziona perché le
 * pipe di validazione girano DENTRO il flusso osservato dall'interceptor
 * (verificato in router-execution-context.js di NestJS). Il legacy li
 * cancellava solo se l'errore riguardava l'immagine: con un'immagine valida e un
 * campo mancante, il file restava in uploads/ per sempre.
 *
 * COM'ERA FINO ALLA FASE F6, E COSA CAMBIA CON FASTIFY
 * Prima questo interceptor eseguiva multer, un middleware Express, e i file
 * restavano dove multer li aveva scritti. @fastify/multipart invece cancella da
 * sé, a ogni risposta, i file che ha scritto: perciò l'immagine di una richiesta
 * riuscita viene spostata da ProductService (storeUploadedImage), e questa
 * cartella contiene solo file in transito.
 *
 * Il limite hard di peso non è configurato qui ma alla registrazione del plugin
 * (app.setup.ts): con Fastify il troncamento avviene mentre il corpo arriva.
 */
@Injectable()
export class ProductImageUploadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ProductImageUploadInterceptor.name);

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const form = await this.receive(request);

    // La richiesta porta il form fino al decoratore del parametro. È lo stesso
    // meccanismo di prima (multer scriveva req.body e req.files), con una
    // differenza: la forma è decisa dal progetto, non dalla libreria.
    withProductForm(request).productForm = form;

    // Se il flusso della richiesta termina con un errore, prima si cancellano i
    // file, poi si rilancia l'errore originale, intatto. `from` trasforma la
    // Promise della cancellazione in un Observable; `mergeMap` aspetta che
    // finisca e passa a `throwError`, che riemette l'errore.
    return next.handle().pipe(
      catchError((error: unknown) =>
        from(discardUploadedFiles(form.images.map((image) => image.path), this.logger)).pipe(
          mergeMap(() => throwError(() => error))
        )
      )
    );
  }

  /**
   * Legge il corpo multipart, traducendo gli errori nel vocabolario del
   * progetto.
   *
   * `saveRequestFiles` scrive ogni file nella cartella indicata e restituisce i
   * percorsi insieme ai campi di testo. Il peso non lo riporta, quindi si legge
   * dal disco: serve al validatore per il limite di business (MAX_FILE_SIZE),
   * che è più basso di quello hard.
   */
  private async receive(request: FastifyRequest): Promise<RawNewProductForm> {
    try {
      const { files, values } = await request.saveRequestFiles({ tmpdir: TEMP_UPLOADS_DIR });

      // Un file arrivato in un campo diverso da `image` è un errore del client,
      // come lo era con multer, che rifiutava i campi inattesi da sé
      // (LIMIT_UNEXPECTED_FILE). @fastify/multipart invece salva qualunque
      // campo file: senza questo controllo, un'immagine inviata nel campo
      // sbagliato verrebbe usata come immagine del prodotto. I file già scritti
      // li cancella il plugin, alla risposta.
      if (files.some((file) => file.fieldname !== PRODUCT_IMAGE_FIELD)) {
        throw new BadRequestException("Richiesta di caricamento dell'immagine non valida");
      }

      const images = await Promise.all(files.map((file) => toUploadedImage(file)));

      return { fields: textFieldsOf(values), images };
    } catch (error: unknown) {
      // Le eccezioni del progetto (il controllo sul campo qui sopra) passano
      // intatte: toHttpException tocca solo gli errori del plugin e di Fastify.
      throw toHttpException(error);
    }
  }
}

/** Ciò che il plugin restituisce per un file salvato su disco. */
interface SavedMultipartFile {
  fieldname: string;
  filename: string;
  mimetype: string;
  filepath: string;
}

/** Un file del plugin nella forma usata dal progetto (vedi uploaded-files.ts). */
async function toUploadedImage(file: SavedMultipartFile): Promise<UploadedImage> {
  const { size } = await stat(file.filepath);

  return {
    originalname: file.filename,
    mimetype: file.mimetype,
    size,
    path: file.filepath,
  };
}

/**
 * I campi di testo del form, nella forma che la pipe di validazione aspetta.
 *
 * @fastify/multipart li consegna come oggetti (`{ type: 'field', value, ... }`),
 * insieme alle voci che descrivono i file: qui si tengono solo i campi di testo
 * e si estrae il valore. Un campo inviato più volte arriva come array, e viene
 * lasciato tale: la validazione lo rifiuterà, come faceva prima.
 */
function textFieldsOf(values: unknown): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const [name, entry] of Object.entries((values ?? {}) as Record<string, unknown>)) {
    if (Array.isArray(entry)) {
      fields[name] = entry.map(valueOf);

      continue;
    }

    if (isTextField(entry)) {
      fields[name] = valueOf(entry);
    }
  }

  return fields;
}

function isTextField(entry: unknown): boolean {
  return typeof entry === 'object' && entry !== null && (entry as { type?: string }).type === 'field';
}

function valueOf(entry: unknown): unknown {
  return (entry as { value?: unknown })?.value;
}

/**
 * Traduce gli errori di ricezione nel vocabolario del progetto.
 *
 * - Superamento del limite hard: 413 "Operazione non permessa.", lo stesso
 *   messaggio volutamente vago del legacy, che lo trattava come un evento di
 *   sicurezza. Il vecchio flag `isFatal` non serve: l'eccezione interrompe la
 *   richiesta prima della validazione, quindi la precedenza è strutturale.
 * - Altri errori del corpo multipart (troppe parti, tipo di contenuto sbagliato):
 *   400, errore del client.
 * - Qualunque altro errore (ad esempio disco pieno) resta un errore del server e
 *   arriva al filter come 500.
 *
 * I file già scritti quando l'errore si verifica li cancella il plugin
 * (cleanRequestFiles nel suo gestore di errore, verificato nel sorgente).
 */
function toHttpException(error: unknown): unknown {
  const code = (error as { code?: string }).code;

  if (code === FILE_TOO_LARGE_CODE) {
    return new PayloadTooLargeException('Operazione non permessa.');
  }

  if (code && CLIENT_MULTIPART_ERROR_CODES.includes(code)) {
    return new BadRequestException("Richiesta di caricamento dell'immagine non valida");
  }

  return error;
}

/**
 * La richiesta vista come portatrice del form: l'unico punto in cui il progetto
 * aggiunge una proprietà propria a una richiesta Fastify, dichiarata qui invece
 * che con un'estensione globale dei tipi della libreria.
 */
export function withProductForm(request: FastifyRequest): { productForm?: RawNewProductForm } {
  return request as FastifyRequest & { productForm?: RawNewProductForm };
}
