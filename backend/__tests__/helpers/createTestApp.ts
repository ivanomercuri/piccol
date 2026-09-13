import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { NEST_APP_OPTIONS, configureApp } from '../../app.setup';

/**
 * Costruisce l'applicazione NestJS per i test end-to-end.
 *
 * Sostituisce il vecchio `import app from '../index'`. Parte dallo STESSO
 * AppModule e applica la STESSA configureApp di main.ts, quindi i test
 * attraversano la stessa catena della produzione: router legacy, filter,
 * interceptor, validazione dell'ambiente. Non va in ascolto su una porta:
 * supertest usa direttamente il server HTTP con app.getHttpServer().
 *
 * Il file non termina in `.test.ts`, quindi Jest non lo esegue come suite
 * (testMatch in jest.config.js).
 *
 * @param options.controllers controller aggiuntivi registrati solo per il
 *   test. Servono a __tests__/nestHosting.test.ts per verificare che rotte
 *   NestJS e router legacy convivano, senza aggiungere endpoint di prova
 *   all'applicazione vera.
 */
export async function createTestApp(
  options: { controllers?: Type<unknown>[] } = {}
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: options.controllers ?? [],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...NEST_APP_OPTIONS,
    // Niente log del framework nei test (ogni rotta registrata stamperebbe
    // una riga a ogni avvio dell'app, cioè per ogni file di test). Gli
    // errori 5xx vengono comunque loggati da AllExceptionsFilter, che usa
    // l'adapter Winston ricevuto per iniezione e non il logger del framework.
    logger: false,
  });

  configureApp(app);

  await app.init();

  return app;
}
