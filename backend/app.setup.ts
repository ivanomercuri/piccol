import express from 'express';
import type { NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { jsonSyntaxErrorMiddleware } from './common/middleware/json-syntax-error.middleware';

/**
 * Punto unico in cui si configura l'app NestJS, usato sia da main.ts sia dai
 * test end-to-end (__tests__/helpers/useTestApp.ts).
 *
 * PERCHÉ UN FILE CONDIVISO
 * È un errore classico dei progetti NestJS: main.ts configura l'app (pipe,
 * middleware, CORS) e i test costruiscono la loro app senza quella
 * configurazione, quindi verificano un'applicazione diversa da quella che
 * gira davvero. Con una sola funzione chiamata da entrambi, i test
 * attraversano esattamente la stessa catena della produzione.
 */

/**
 * Opzioni di creazione dell'app.
 *
 * `bodyParser: false`: il parser JSON di NestJS resta disattivato anche ora
 * che i router Express legacy non esistono più (fase F5 della migrazione).
 * Il motivo originale era proprio quei router; quello che resta è il
 * messaggio "errore json: ..." del contratto API (docs/API.md).
 *
 * NestJS registra il proprio parser dentro init(), cioè DOPO tutti gli
 * app.use() di configureApp — l'ordine di init() è: body parser, moduli,
 * rotte NestJS, gestori 404/errori (verificato in
 * @nestjs/core/nest-application.js). Express fa avanzare un errore solo
 * verso i middleware registrati dopo quello che l'ha generato: con il parser
 * di NestJS, jsonSyntaxErrorMiddleware starebbe PRIMA del parser e non ne
 * vedrebbe mai gli errori. E non si può nemmeno registrarlo dopo init(),
 * perché finirebbe dietro al gestore 404, che risponde a tutto. A valle resta
 * solo il gestore di NestJS, che converte il SyntaxError in una
 * BadRequestException perdendo l'errore originale (vedi il commento in
 * json-syntax-error.middleware.ts).
 *
 * Effetto collaterale voluto: il parser di NestJS attiverebbe anche
 * express.urlencoded, cioè i body `application/x-www-form-urlencoded`, che
 * l'API oggi non accetta. Tenendo il parser esplicito, il contratto non si
 * allarga in silenzio.
 *
 * Trappola verificata: impostando `true` SENZA togliere express.json() da
 * configureApp, il JSON malformato continua a funzionare, perché NestJS salta
 * il proprio parser JSON se ne trova già montato uno con lo stesso nome di
 * funzione (isMiddlewareApplied in express-adapter.js); ma aggiunge comunque
 * quello urlencoded. È ciò che rileva il test "non legge i body
 * application/x-www-form-urlencoded" in __tests__/errorHandling.test.ts.
 */
export const NEST_APP_OPTIONS: NestApplicationOptions = { bodyParser: false };

/**
 * Applica all'app i middleware Express che devono precedere le rotte.
 *
 * Va chiamata PRIMA di app.init() (o di app.listen(), che lo esegue): tutto
 * ciò che si registra qui con app.use() finisce sull'istanza Express nel
 * momento stesso della chiamata, quindi prima delle rotte NestJS e dei loro
 * gestori 404/errori, che init() aggiunge in coda. L'ordine risultante è:
 *
 *   CORS → express.json() → traduzione errori JSON
 *   → rotte NestJS → 404 NestJS → gestore errori NestJS
 *
 * Fino alla fase F4 questa funzione montava anche i router Express non
 * ancora migrati e il middleware responseFormatter (res.success/res.error)
 * che usavano. Sono spariti in F5 con l'ultima rotta legacy, GET /routes
 * (decisione D8 in docs/MIGRAZIONE-NESTJS.md).
 */
export function configureApp(app: NestExpressApplication): void {
  // Stesso comportamento del vecchio app.use(cors()): nessuna opzione, quindi
  // tutte le origini ammesse.
  app.enableCors();

  app.use(express.json());

  // Subito dopo il parser, perché intercetti solo gli errori del parser:
  // vedi il commento in json-syntax-error.middleware.ts.
  app.use(jsonSyntaxErrorMiddleware);
}
