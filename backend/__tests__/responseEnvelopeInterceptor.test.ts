// ResponseEnvelopeInterceptor in isolamento: si simula il controller con un
// Observable che emette un valore, senza avviare l'app.
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from '../common/interceptors/response-envelope.interceptor';

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor<unknown>();

  // Contesto minimo: l'interceptor legge solo lo statusCode della risposta.
  function contextWithStatus(statusCode: number): ExecutionContext {
    return {
      switchToHttp: () => ({ getResponse: () => ({ statusCode }) }),
    } as unknown as ExecutionContext;
  }

  // `of(valore)` crea un Observable che emette quel valore e termina: è ciò
  // che next.handle() restituisce quando il controller ha risposto.
  // lastValueFrom lo trasforma in una Promise, per poterlo attendere nel test.
  function handlerReturning(value: unknown): CallHandler {
    return { handle: () => of(value) };
  }

  // Il caso base: ciò che il controller restituisce finisce in `data`,
  // dentro l'involucro identico a quello di res.success.
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
  // mentre i router legacy rispondono 200 — da ricordare migrando in F2.
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
