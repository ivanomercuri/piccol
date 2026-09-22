import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';
import { megabytesToBytes } from './product-image.validator';
import { discardUploadedFiles, UPLOADS_DIR } from './uploaded-files';

/** Campo multipart da cui arrivano le immagini, come nella rotta legacy. */
export const PRODUCT_IMAGE_FIELD = 'image';

/**
 * Messaggi di busboy (il parser multipart usato da multer) per un body
 * malformato. Sono errori del client, ma arrivano come Error generici, quindi
 * si riconoscono dal testo. È lo stesso elenco che usa l'interceptor di
 * NestJS per gli upload (multer.constants.js in @nestjs/platform-express).
 */
const MALFORMED_MULTIPART_MESSAGES = [
  'Multipart: Boundary not found',
  'Malformed part header',
  'Unexpected end of form',
  'Unexpected end of file',
];

/**
 * Riceve le immagini di un nuovo prodotto e ne gestisce l'intero ciclo di
 * vita su disco. Sostituisce uploadMiddleware.ts e
 * handleMulterErrorsMiddleware.ts.
 *
 * PERCHÉ UN INTERCEPTOR SCRITTO QUI E NON FilesInterceptor DI NESTJS
 * FilesInterceptor fa la stessa cosa (anche lui chiama multer), ma non
 * permette due cose di cui questa rotta ha bisogno:
 * - leggere il limite hard da ConfigService: le sue opzioni si scrivono nel
 *   decoratore, quindi sono fisse nel sorgente — era proprio il difetto del
 *   legacy, con il limite scritto a mano invece di MAX_FILE_HARD_SIZE;
 * - tradurre gli errori in italiano: i suoi messaggi sono quelli inglesi di
 *   multer ("File too large").
 * Il codice qui sotto ricalca il suo funzionamento, in circa venti righe.
 *
 * I FILE TEMPORANEI SI CANCELLANO QUI, A QUALUNQUE ERRORE
 * Chi crea i file ne è responsabile fino alla fine. Se la richiesta fallisce
 * dopo la ricezione — campi non validi, immagine non valida, errore del
 * service — i file vengono rimossi. È possibile perché in NestJS le pipe di
 * validazione girano DENTRO il flusso che l'interceptor osserva (verificato in
 * router-execution-context.js). Il legacy li cancellava solo se l'errore
 * riguardava l'immagine: con un'immagine valida e un campo mancante, il file
 * restava in uploads/ per sempre.
 *
 * Se invece la richiesta va a buon fine, i file restano: sono il risultato
 * dell'upload, e ProductService.create ne salva l'indirizzo nel database
 * (fase F6). L'unico file che il service cancella da sé è quello di una
 * richiesta riconosciuta come duplicata, che si conclude con un successo.
 */
@Injectable()
export class ProductImageUploadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ProductImageUploadInterceptor.name);

  private readonly receiveImages: RequestHandler;

  constructor(config: ConfigService) {
    this.receiveImages = multer({
      dest: UPLOADS_DIR,
      // Nessun fileFilter sul Content-Type, a differenza del legacy: tutti i
      // file entro il limite hard vengono salvati, e il tipo lo verifica
      // ProductImageValidator guardando i byte reali, con lo stesso messaggio.
      // Così tutti gli errori sulle immagini nascono in un posto solo, invece
      // di dover essere passati dal filtro di multer alla validazione tramite
      // uno stato appeso alla richiesta.
      limits: {
        fileSize: megabytesToBytes(config.getOrThrow<number>('MAX_FILE_HARD_SIZE')),
      },
    }).array(PRODUCT_IMAGE_FIELD);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    await this.receive(request, http.getResponse<Response>());

    // Se il flusso della richiesta termina con un errore, prima si cancellano
    // i file, poi si rilancia l'errore originale, intatto. `from` trasforma la
    // Promise della cancellazione in un Observable; `mergeMap` aspetta che
    // finisca e passa a `throwError`, che riemette l'errore.
    return next.handle().pipe(
      catchError((error: unknown) =>
        from(this.removeUploadedFiles(request)).pipe(mergeMap(() => throwError(() => error)))
      )
    );
  }

  /** Esegue multer come una Promise, traducendo i suoi errori. */
  private receive(request: Request, response: Response): Promise<void> {
    return new Promise((resolve, reject) => {
      this.receiveImages(request, response, (error?: unknown) =>
        error ? reject(toHttpException(error)) : resolve()
      );
    });
  }

  /** Cancella i file salvati da questa richiesta (vedi uploaded-files.ts). */
  private removeUploadedFiles(request: Request): Promise<void> {
    // Cast: @types/multer tipizza req.files come array O dizionario per campo,
    // a seconda del metodo di multer usato. Con .array() è sempre un array.
    const files = (request.files as Express.Multer.File[] | undefined) ?? [];

    return discardUploadedFiles(files, this.logger);
  }
}

/**
 * Traduce gli errori di ricezione nel vocabolario del progetto.
 *
 * - Superamento del limite hard: 413 "Operazione non permessa.", lo stesso
 *   messaggio volutamente vago del legacy, che lo trattava come un evento di
 *   sicurezza. Lo status passa da 400 a 413, il codice HTTP previsto per un
 *   corpo troppo grande, come annunciato nell'assessment (§4.4). E il vecchio
 *   flag `isFatal` non serve più: l'eccezione interrompe la richiesta prima che
 *   la validazione venga eseguita, quindi la precedenza è strutturale.
 * - Altri errori di multer (campo con un nome inatteso, troppe parti) e
 *   multipart malformato: 400, errore del client.
 * - Qualunque altro errore (ad esempio disco pieno) resta un errore del server
 *   e arriva al filter come 500.
 *
 * Multer, quando interrompe un upload per errore, cancella da solo i file già
 * scritti per quella richiesta.
 */
function toHttpException(error: unknown): unknown {
  if (error instanceof multer.MulterError) {
    return error.code === 'LIMIT_FILE_SIZE'
      ? new PayloadTooLargeException('Operazione non permessa.')
      : new BadRequestException("Richiesta di caricamento dell'immagine non valida");
  }

  if (error instanceof Error && MALFORMED_MULTIPART_MESSAGES.includes(error.message)) {
    return new BadRequestException("Richiesta di caricamento dell'immagine non valida");
  }

  return error;
}
