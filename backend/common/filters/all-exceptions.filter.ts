import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WinstonLoggerService } from '../logger/winston-logger.service';

const UNEXPECTED_ERROR_MESSAGE = 'Qualcosa è andato storto!';
const ROUTE_NOT_FOUND_MESSAGE = 'Non trovato';

/**
 * Forma di ogni risposta d'errore del progetto: identica a quella che
 * produce oggi res.error in middlewares/responseFormatter.ts, così client e
 * test end-to-end non vedono differenze fra una rotta legacy e una NestJS.
 * `error` può essere una stringa o un array (docs/API.md → "Formato delle
 * risposte").
 */
interface ErrorEnvelope {
  success: false;
  status: number;
  data: null;
  error: unknown;
}

/**
 * Gestore unico degli errori dell'applicazione: sostituisce sia
 * errorMiddleware.ts (errori propagati con next(err)) sia noPathMiddleware.ts
 * (rotte inesistenti).
 *
 * `@Catch()` senza argomenti significa "intercetta tutto", non solo le
 * HttpException: anche un errore imprevisto (una query fallita, un bug) deve
 * uscire nel formato del progetto invece che con la risposta di default di
 * NestJS.
 *
 * COSA LO RAGGIUNGE
 * - le eccezioni lanciate dai controller NestJS (dalla fase F2);
 * - gli errori Express propagati con next(err) — NestJS registra in coda
 *   all'app un gestore che li rilancia dentro il proprio sistema di filtri;
 * - le rotte inesistenti — NestJS registra in coda anche un gestore 404 che
 *   lancia NotFoundException.
 * I router legacy che rispondono da sé con res.error NON passano da qui: una
 * risposta già inviata non è un'eccezione.
 *
 * È registrato come provider APP_FILTER in AppModule e non con
 * app.useGlobalFilters() in main.ts: in quel modo vale anche nei test, che
 * costruiscono l'app a partire dallo stesso AppModule, e può ricevere il
 * logger per dependency injection.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: WinstonLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const status = statusOf(exception);

    // Solo gli errori 5xx sono "imprevisti" e meritano il log con lo stack.
    // I 4xx (validazione, autenticazione fallita, rotta inesistente) sono
    // parte del funzionamento normale: loggarli come errori sommergerebbe
    // quelli veri. È la stessa politica di res.error, che logga solo quando
    // il controller gli passa un'istanza di Error, cioè nei rami catch.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logUnexpected(exception, request);
    }

    // Se qualcuno ha già iniziato a rispondere (ad esempio un middleware
    // legacy che invia la risposta e poi chiama anche next(err)), un secondo
    // invio lancerebbe "Cannot set headers after they are sent" dentro il
    // gestore degli errori stesso. L'errore è già stato loggato sopra se
    // grave; qui non resta che fermarsi.
    if (response.headersSent) {
      return;
    }

    const envelope: ErrorEnvelope = {
      success: false,
      status,
      data: null,
      error: clientMessageOf(exception, request),
    };

    response.status(status).json(envelope);
  }

  private logUnexpected(exception: unknown, request: Request): void {
    // Stessa forma di metadati usata da res.error e dal vecchio
    // errorMiddleware, così i log restano confrontabili nel tempo.
    this.logger.error('Errore:', {
      message:
        exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
      path: request.originalUrl,
      method: request.method,
    });
  }
}

function statusOf(exception: unknown): number {
  return exception instanceof HttpException
    ? exception.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * Decide che cosa vede il client nel campo `error`.
 *
 * Un errore che NON è una HttpException è per definizione imprevisto: il suo
 * messaggio è un dettaglio interno (il testo di un errore Prisma, un nome di
 * tabella, un percorso di file) e non deve MAI arrivare al client. Il
 * vecchio errorMiddleware invece rispondeva con err.message quando c'era:
 * qui la regola si inverte deliberatamente, per ridurre ciò che un
 * attaccante può imparare provocando errori. Il dettaglio completo resta nei
 * log.
 *
 * Una HttpException invece è lanciata apposta dal codice, e il suo messaggio
 * è pensato per il client: si restituisce così com'è (stringa o array).
 */
function clientMessageOf(exception: unknown, request: Request): unknown {
  if (!(exception instanceof HttpException)) {
    return UNEXPECTED_ERROR_MESSAGE;
  }

  if (isUnmatchedRoute(exception, request)) {
    return ROUTE_NOT_FOUND_MESSAGE;
  }

  const body = exception.getResponse();

  if (typeof body === 'string') {
    return body;
  }

  // Le eccezioni costruite con un oggetto (ad esempio quelle della
  // ValidationPipe, dalla fase F2) hanno la forma { message, error,
  // statusCode }: interessa solo `message`, che può essere un array.
  if (typeof body === 'object' && body !== null && 'message' in body) {
    return body.message;
  }

  return exception.message;
}

/**
 * Distingue "nessuna rotta ha gestito la richiesta" da una 404 lanciata di
 * proposito da un controller (es. "Prodotto non trovato", che deve
 * mantenere il proprio messaggio).
 *
 * NestJS non espone questa informazione in modo strutturato: il suo gestore
 * 404 lancia semplicemente `new NotFoundException(\`Cannot ${method} ${url}\`)`,
 * con l'URL preso da request.originalUrl (verificato nel sorgente installato:
 * registerNotFoundHandler in @nestjs/core/router/routes-resolver.js e
 * getRequestUrl in @nestjs/platform-express/adapters/express-adapter.js).
 * Il confronto sul messaggio ESATTO, URL compreso, rende impossibile che una
 * 404 di un controller venga scambiata per questa per caso.
 *
 * Il prezzo è l'accoppiamento al formato di quel messaggio. Se una versione
 * futura di NestJS lo cambiasse, il client riceverebbe il testo inglese
 * invece di "Non trovato" — e il test end-to-end sulla 404 in
 * __tests__/errorHandling.test.ts fallirebbe subito, quindi il cambiamento
 * non passerebbe inosservato.
 */
function isUnmatchedRoute(exception: HttpException, request: Request): boolean {
  return (
    exception instanceof NotFoundException &&
    exception.message === `Cannot ${request.method} ${request.originalUrl}`
  );
}
