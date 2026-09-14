import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

/**
 * Forma di ogni risposta di successo del progetto: identica a quella di
 * res.success in middlewares/responseFormatter.ts.
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
 * È il corrispettivo di res.success: con NestJS il controller non chiama più
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
 * AllExceptionsFilter. Non tocca nemmeno i router legacy, che non sono
 * controller NestJS e rispondono da sé.
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
    const response = context.switchToHttp().getResponse<Response>();

    // context.getHandler() è il metodo del controller che sta per essere
    // eseguito: il messaggio si legge dai SUOI metadati. Le rotte senza
    // @ResponseMessage restano con il messaggio vuoto, come res.success
    // chiamato senza secondo argomento.
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
        // che è il default di NestJS e NON quello dei router legacy.
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
