// ResponseEnvelopeInterceptor in isolamento: si simula il controller con un
// Observable che emette un valore, senza avviare l'app.
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  // Reflector reale, non un finto: è la classe di NestJS che legge i
  // metadati, e usarla vera verifica anche che @ResponseMessage li scriva
  // dove l'interceptor li cerca.
  const interceptor = new ResponseEnvelopeInterceptor<unknown>(new Reflector());

  // Un metodo qualunque, senza metadati: rappresenta una rotta senza
  // @ResponseMessage.
  function plainHandler() {
    return undefined;
  }

  // Contesto minimo: l'interceptor legge lo statusCode della risposta e il
  // metodo del controller da cui leggere i metadati.
  function contextWithStatus(
    statusCode: number,
    handler: () => unknown = plainHandler
  ): ExecutionContext {
    return {
      switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
      getHandler: () => handler,
    } as unknown as ExecutionContext;
  }

  // `of(valore)` crea un Observable che emette quel valore e termina: è ciò
  // che next.handle() restituisce quando il controller ha risposto.
  // lastValueFrom lo trasforma in una Promise, per poterlo attendere nel test.
  function handlerReturning(value: unknown): CallHandler {
    return { handle: () => of(value) };
  }

  // Il caso base: ciò che il controller restituisce finisce in `data`,
  // dentro l'involucro del progetto (docs/API.md).
  it('avvolge il valore restituito dal controller nel formato del progetto', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(contextWithStatus(200), handlerReturning({ id: 1 }))
    );

    expect(result).toEqual({
      success: true,
      status: 200,
      data: { id: 1 },
      message: '',
    });
  });

  // Lo status non è fisso a 200: è quello già impostato da NestJS sulla
  // risposta. Rilevante perché le POST NestJS rispondono 201 di default,
  // mentre quelle del progetto fissano 200 con @HttpCode.
  it('riporta lo status reale della risposta, non un 200 fisso', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(contextWithStatus(201), handlerReturning({ created: true }))
    );

    expect(result.status).toBe(201);
  });

  // Un controller che non restituisce nulla non deve produrre una risposta
  // senza la chiave `data`: il contratto la vuole sempre presente.
  it('usa null come data quando il controller non restituisce nulla', async () => {
    const result = await lastValueFrom(
      interceptor.intercept(contextWithStatus(200), handlerReturning(undefined))
    );

    expect(result.data).toBeNull();
  });

  // Il messaggio di successo dichiarato con @ResponseMessage sul metodo del
  // controller finisce nel campo `message`, dove prima della migrazione
  // arrivava il secondo argomento di res.success (es. "Logout effettuato con
  // successo").
  it('usa il messaggio dichiarato con @ResponseMessage sul metodo', async () => {
    class Controller {
      @ResponseMessage('Logout effettuato con successo')
      logout() {
        return {};
      }
    }

    const handler = Controller.prototype.logout;

    const result = await lastValueFrom(
      interceptor.intercept(contextWithStatus(200, handler), handlerReturning({}))
    );

    expect(result.message).toBe('Logout effettuato con successo');
  });

  // Valori "falsy" ma legittimi non vanno confusi con l'assenza di dati:
  // `??` sostituisce solo null e undefined, mentre `||` trasformerebbe anche
  // 0, false e la stringa vuota in null. È il motivo della scelta di `??`.
  it('conserva valori falsy legittimi come 0, false e stringa vuota', async () => {
    for (const value of [0, false, '']) {
      const result = await lastValueFrom(
        interceptor.intercept(contextWithStatus(200), handlerReturning(value))
      );

      expect(result.data).toBe(value);
    }
  });
});
