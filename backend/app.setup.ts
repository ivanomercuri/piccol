import express from 'express';
import type { NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import responseFormatter from './middlewares/responseFormatter';
import { jsonSyntaxErrorMiddleware } from './middlewares/jsonSyntaxErrorMiddleware';
import productRoutes from './routes/productRoutes';
import listRoutes from './routes/listRoutes';

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
 * `bodyParser: false` è necessario finché esistono router legacy. NestJS
 * registra il proprio parser JSON dentro init(), cioè DOPO tutti gli
 * app.use() eseguiti in configureApp — l'ordine di init() è: body parser,
 * moduli, rotte NestJS, gestori 404/errori (verificato in
 * @nestjs/core/nest-application.js). I router legacy, montati prima,
 * riceverebbero quindi un req.body vuoto. Si disattiva il parser di NestJS e
 * si monta express.json() esplicitamente in testa, dove serve a tutti.
 */
export const NEST_APP_OPTIONS: NestApplicationOptions = { bodyParser: false };

/**
 * Applica all'app la catena di middleware e i router legacy.
 *
 * Va chiamata PRIMA di app.init() (o di app.listen(), che lo esegue): tutto
 * ciò che si registra qui con app.use() finisce sull'istanza Express nel
 * momento stesso della chiamata, quindi prima delle rotte NestJS e dei loro
 * gestori 404/errori, che init() aggiunge in coda. L'ordine risultante è:
 *
 *   responseFormatter → CORS → express.json() → traduzione errori JSON
 *   → router legacy → rotte NestJS → 404 NestJS → gestore errori NestJS
 *
 * CONSEGUENZA DA TENERE A MENTE NELLE FASI F2–F4
 * Se una rotta NestJS e una legacy rispondono allo stesso metodo e percorso,
 * vince SEMPRE la legacy, perché viene prima. Quando un dominio migra, il
 * suo router va quindi tolto da mountLegacyRouters nello stesso commit in
 * cui nasce il modulo NestJS: la versione nuova non sarebbe raggiungibile
 * finché la vecchia resta montata. Il comportamento è verificato in
 * __tests__/nestHosting.test.ts.
 */
export function configureApp(app: NestExpressApplication): void {
  // Deve precedere i router legacy, che chiamano res.success/res.error. Non
  // interferisce con le rotte NestJS, che non usano quei metodi.
  app.use(responseFormatter);

  // Stesso comportamento del vecchio app.use(cors()): nessuna opzione, quindi
  // tutte le origini ammesse.
  app.enableCors();

  app.use(express.json());

  // Subito dopo il parser, perché intercetti solo gli errori del parser:
  // vedi il commento in jsonSyntaxErrorMiddleware.ts.
  app.use(jsonSyntaxErrorMiddleware);

  mountLegacyRouters(app);
}

/**
 * I router Express non ancora migrati. È la parte transitoria di questo
 * file, tenuta in una funzione separata perché ha un ciclo di vita diverso
 * dal resto: ogni fase F2–F4 toglie una riga da qui, e F5 cancella la
 * funzione. Il resto di configureApp invece resta.
 *
 * Il 404 (noPathMiddleware) e il gestore degli errori (errorMiddleware) non
 * compaiono più: montati qui, verrebbero prima delle rotte NestJS e le
 * renderebbero irraggiungibili — il 404 catturerebbe tutto. Il loro compito
 * è passato ad AllExceptionsFilter.
 */
function mountLegacyRouters(app: NestExpressApplication): void {
  // Rimossi `app.use('/', customerRoutes)` in F2 (modules/customer/ e
  // health.controller.ts) e `app.use('/admin', adminRoutes)` in F3
  // (modules/user/).
  app.use('/products', productRoutes);

  app.use(listRoutes);
}
