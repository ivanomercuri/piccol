import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core';
import { WinstonLoggerService } from '../logger/winston-logger.service';

const UNEXPECTED_ERROR_MESSAGE = 'Qualcosa è andato storto!';
const ROUTE_NOT_FOUND_MESSAGE = 'Non trovato';

/**
 * Messaggio inglese con cui Fastify rifiuta un tipo di contenuto per cui non ha
 * un parser (un body di form su una rotta che accetta JSON, o una richiesta
 * senza Content-Type su POST /products/new), e la sua traduzione.
 *
 * Il rifiuto avviene prima di qualunque codice del progetto — è il parser a
 * mancare — quindi questo è il primo punto in cui si può intervenire. I messaggi
 * rivolti al client sono in italiano (AGENTS.md).
 */
const FRAMEWORK_UNSUPPORTED_MEDIA_TYPE = 'Unsupported Media Type';

const UNSUPPORTED_MEDIA_TYPE_MESSAGE = 'Tipo di contenuto non supportato';

/**
 * Forma di ogni risposta d'errore del progetto. È la stessa che produceva
 * res.error nelle rotte Express, conservata per tutta la migrazione a NestJS
 * così che client e test end-to-end non vedessero differenze fra una rotta
 * migrata e una non ancora migrata. `error` può essere una stringa o un array
 * (docs/API.md → "Formato delle risposte").
 */
/**
 * Ciò che serve sapere della richiesta: il percorso e il metodo, già estratti
 * dall'adapter. Tenerli in un oggetto proprio evita di passare in giro la
 * richiesta grezza, che ha una forma diversa su ogni piattaforma.
 */
interface RequestDescription {
  path: string;
  method: string;
}

interface ErrorEnvelope {
  success: false;
  status: number;
  data: null;
  error: unknown;
}

/**
 * Gestore unico degli errori dell'applicazione. Ha sostituito sia
 * errorMiddleware.ts (errori propagati con next(err)) sia noPathMiddleware.ts
 * (rotte inesistenti), e dalla fase F5 anche res.error.
 *
 * `@Catch()` senza argomenti significa "intercetta tutto", non solo le
 * HttpException: anche un errore imprevisto (una query fallita, un bug) deve
 * uscire nel formato del progetto invece che con la risposta di default di
 * NestJS.
 *
 * COSA LO RAGGIUNGE
 * - le eccezioni lanciate da controller, guard, pipe e interceptor NestJS;
 * - gli errori dei middleware Express propagati con next(err), come quello
 *   di json-syntax-error.middleware.ts — NestJS registra in coda all'app un
 *   gestore che li rilancia dentro il proprio sistema di filtri;
 * - le rotte inesistenti — NestJS registra in coda anche un gestore 404 che
 *   lancia NotFoundException.
 *
 * È registrato come provider APP_FILTER in AppModule e non con
 * app.useGlobalFilters() in main.ts: in quel modo vale anche nei test, che
 * costruiscono l'app a partire dallo stesso AppModule, e può ricevere per
 * dependency injection il logger e l'adapter HTTP.
 *
 * PERCHÉ PASSA DA HttpAdapterHost (dalla fase F7)
 * Richiesta e risposta hanno una forma diversa su ogni piattaforma: la reply di
 * Fastify non ha il metodo `json()` di Express, e l'URL completo si legge in
 * proprietà diverse. `httpAdapter` è l'astrazione con cui NestJS parla alla
 * piattaforma in uso — `reply`, `getRequestUrl`, `getRequestMethod`,
 * `isHeadersSent` — quindi questo file non dipende più da Express né da Fastify.
 * Era il pezzo di codice che il passaggio a Fastify ha rotto: rispondeva con
 * `response.status(...).json(...)`, e ogni errore diventava un 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly adapterHost: HttpAdapterHost
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;

    const http = host.switchToHttp();
    const request = http.getRequest<unknown>();
    const response = http.getResponse<unknown>();

    const status = statusOf(exception);

    const description = requestDescription(httpAdapter, request);

    // Solo gli errori 5xx sono "imprevisti" e meritano il log con lo stack.
    // I 4xx (validazione, autenticazione fallita, rotta inesistente) sono
    // parte del funzionamento normale: loggarli come errori sommergerebbe
    // quelli veri. È la stessa politica che aveva res.error, che loggava solo
    // quando il controller gli passava un'istanza di Error, cioè nei rami
    // catch.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logUnexpected(exception, description);
    }

    // Se qualcuno ha già iniziato a rispondere (ad esempio un middleware
    // Express che invia la risposta e poi chiama anche next(err)), un secondo
    // invio lancerebbe "Cannot set headers after they are sent" dentro il
    // gestore degli errori stesso. L'errore è già stato loggato sopra se
    // grave; qui non resta che fermarsi.
    if (httpAdapter.isHeadersSent(response)) {
      return;
    }

    const envelope: ErrorEnvelope = {
      success: false,
      status,
      data: null,
      error: clientMessageOf(exception, description),
    };

    httpAdapter.reply(response, envelope, status);
  }

  private logUnexpected(exception: unknown, request: RequestDescription): void {
    // Stessa forma di metadati usata da res.error e dal vecchio
    // errorMiddleware prima della migrazione, così i log restano
    // confrontabili nel tempo.
    this.logger.error('Errore:', {
      message:
        exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
      path: request.path,
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
function clientMessageOf(exception: unknown, request: RequestDescription): unknown {
  if (!(exception instanceof HttpException)) {
    return UNEXPECTED_ERROR_MESSAGE;
  }

  if (isUnmatchedRoute(exception, request)) {
    return ROUTE_NOT_FOUND_MESSAGE;
  }

  if (exception.message === FRAMEWORK_UNSUPPORTED_MEDIA_TYPE) {
    return UNSUPPORTED_MEDIA_TYPE_MESSAGE;
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
 * con metodo e URL letti dall'adapter (verificato nel sorgente installato:
 * registerNotFoundHandler in @nestjs/core/router/routes-resolver.js).
 * Il confronto sul messaggio ESATTO, URL compreso, rende impossibile che una
 * 404 di un controller venga scambiata per questa per caso.
 *
 * Il prezzo è l'accoppiamento al formato di quel messaggio. Se una versione
 * futura di NestJS lo cambiasse, il client riceverebbe il testo inglese
 * invece di "Non trovato" — e il test end-to-end sulla 404 in
 * __tests__/errorHandling.test.ts fallirebbe subito, quindi il cambiamento
 * non passerebbe inosservato.
 */
function isUnmatchedRoute(exception: HttpException, request: RequestDescription): boolean {
  return (
    exception instanceof NotFoundException &&
    exception.message === `Cannot ${request.method} ${request.path}`
  );
}

/**
 * Percorso e metodo della richiesta, letti tramite l'adapter.
 *
 * Sono gli stessi due metodi con cui NestJS costruisce il messaggio della 404
 * (`getRequestMethod` e `getRequestUrl`, in routes-resolver.js): il confronto di
 * isUnmatchedRoute resta quindi esatto su qualunque piattaforma, senza che
 * questo file sappia dove ciascuna tiene l'URL completo — Express in
 * `originalUrl`, Fastify in `raw.url`.
 */
function requestDescription(
  httpAdapter: AbstractHttpAdapter,
  request: unknown
): RequestDescription {
  return {
    path: httpAdapter.getRequestUrl(request) ?? '',
    method: httpAdapter.getRequestMethod(request) ?? '',
  };
}
