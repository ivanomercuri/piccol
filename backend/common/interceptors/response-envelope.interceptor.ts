import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

/**
 * Forma di ogni risposta di successo del progetto (docs/API.md → "Formato
 * delle risposte"). È la stessa che produceva res.success nelle rotte
 * Express, rimasta invariata per tutta la migrazione a NestJS.
 */
export interface SuccessEnvelope<T> {
  success: true;
  status: number;
  data: T | null;
  message: string;
}

/**
 * Avvolge nel formato del progetto ciò che un controller NestJS restituisce.
 *
 * Ha preso il posto di res.success (middlewares/responseFormatter.ts, rimosso
 * nella fase F5 della migrazione): con NestJS il controller non chiama più
 * un metodo sulla risposta, restituisce semplicemente il dato
 * (`return user;`), e questo interceptor lo incapsula. Il controller resta
 * ignaro del formato di trasporto — che è il motivo per cui si usa un
 * interceptor invece di ripetere l'involucro in ogni metodo.
 *
 * OBSERVABLE, PER CHI VIENE DA PHP
 * next.handle() non restituisce il valore del controller ma un Observable
 * (libreria RxJS): un flusso che PRODURRÀ quel valore quando il controller
 * avrà finito, anche se è asincrono. `pipe(map(...))` registra una
 * trasformazione da applicare al valore quando arriva. È simile a una
 * catena di Promise.then(), ma NestJS lo usa perché un interceptor può anche
 * agire prima della chiamata, dopo, o sostituire il flusso intero (cache,
 * timeout). Non esiste un equivalente diretto in PHP, dove la chiamata al
 * controller è semplicemente sincrona.
 *
 * Non tocca gli errori: un'eccezione non passa da map() e arriva invece ad
 * AllExceptionsFilter.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, SuccessEnvelope<T>>
{
  // Reflector è il servizio di NestJS che legge i metadati attaccati a
  // classi e metodi con SetMetadata: qui serve a leggere @ResponseMessage.
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<SuccessEnvelope<T>> {
    // Tipo strutturale invece di quello della piattaforma: l'unica cosa che
    // serve è lo status già impostato sulla risposta, e si chiama `statusCode`
    // sia sulla Response di Express sia sulla reply di Fastify.
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();

    // context.getHandler() è il metodo del controller che sta per essere
    // eseguito: il messaggio si legge dai SUOI metadati. Le rotte senza
    // @ResponseMessage restano con il messaggio vuoto, come faceva
    // res.success chiamato senza secondo argomento.
    const message =
      this.reflector.get<string | undefined>(
        RESPONSE_MESSAGE_KEY,
        context.getHandler()
      ) ?? '';

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        // Lo status si legge qui e non si fissa a 200: NestJS lo imposta
        // sulla risposta PRIMA di eseguire gli interceptor (verificato in
        // router-execution-context.js), e varia — ad esempio 201 per le POST,
        // che è il default di NestJS, o 200 dove un controller lo fissa con
        // @HttpCode.
        status: response.statusCode,
        // Un controller che non restituisce nulla produrrebbe una risposta
        // senza la chiave `data`. `null` rende il contratto stabile: `data`
        // è sempre presente, come nelle risposte d'errore.
        data: data ?? null,
        message,
      }))
    );
  }
}
