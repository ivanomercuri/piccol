// Convivenza fra router Express legacy e rotte NestJS nella stessa app.
//
// È il test che chiude l'incognita dichiarata nell'assessment (§3 di
// docs/MIGRAZIONE-NESTJS.md): l'ordine di registrazione fra i router montati
// con app.use() e le rotte di NestJS andava verificato, non dato per buono.
// Tutte le fasi F2–F4 poggiano su quello che questo file dimostra.
//
// In F1 l'applicazione non ha ancora nessun controller NestJS vero. Per
// esercitare filter, interceptor e dependency injection con richieste HTTP
// reali, il file registra controller di prova visibili SOLO in questo test
// (tramite l'opzione `controllers` di useTestApp), senza aggiungere endpoint
// all'app vera.
import { BadRequestException, Controller, Get, Post } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import { prisma as sharedPrismaClient } from '../prisma/client';
import { useTestApp } from './helpers/useTestApp';

// Controller di prova con un metodo per ciascun comportamento da verificare.
@Controller('__probe')
class ProbeController {
  // Se emitDecoratorMetadata non fosse attivo, NestJS non saprebbe che cosa
  // iniettare qui e passerebbe undefined SENZA dare errore: è il guasto
  // silenzioso descritto in tsconfig.json. Il metodo read() lo rende
  // osservabile dall'esterno.
  constructor(private readonly prisma: PrismaClient) {}

  @Get()
  read() {
    return {
      injected: this.prisma !== undefined,
      // Stessa istanza del singleton usato dai router legacy, non una
      // seconda: un solo pool di connessioni per processo (PrismaModule).
      sameInstanceAsLegacy: this.prisma === sharedPrismaClient,
    };
  }

  @Post()
  create() {
    return { created: true };
  }

  @Get('empty')
  empty() {
    return undefined;
  }

  @Get('bad-request')
  badRequest() {
    throw new BadRequestException('Richiesta non valida');
  }

  @Get('crash')
  crash() {
    throw new Error('dettaglio interno che non deve uscire');
  }
}

// Controller di prova che dichiara GET / — lo stesso metodo e percorso già
// serviti dal router legacy customerRoutes. Serve a verificare chi vince.
@Controller()
class ShadowedRootController {
  @Get()
  root() {
    return 'risposta NestJS';
  }
}

// Avvio e chiusura gestiti dall'helper, alla radice del file (vedi
// helpers/useTestApp.ts). I controller di prova esistono solo in quest'app.
const testApp = useTestApp({
  controllers: [ProbeController, ShadowedRootController],
});

describe('Convivenza router legacy e rotte NestJS', () => {
  describe('ordine di registrazione', () => {
    // Il cuore dell'incognita. I router legacy sono montati con app.use()
    // prima di init(), le rotte NestJS vengono aggiunte dentro init(): quindi
    // su uno stesso percorso risponde il legacy. Conseguenza operativa per
    // F2–F4: quando un dominio migra, il suo router legacy va smontato nello
    // stesso commit, altrimenti la nuova rotta NestJS non è raggiungibile.
    it('su uno stesso metodo e percorso vince il router legacy, montato prima', async () => {
      const res = await request(testApp.http).get('/');

      expect(res.status).toBe(200);

      expect(res.body.data).toBe('𝕴𝖙 𝖂𝖔𝖗𝖐𝖘!');
    });

    // Controprova: i router legacy non inghiottono le richieste che non li
    // riguardano. Un Router Express che non trova una rotta chiama next(),
    // quindi la richiesta prosegue fino alle rotte NestJS.
    it('una rotta NestJS che non collide con i router legacy è raggiungibile', async () => {
      const res = await request(testApp.http).get('/__probe');

      expect(res.status).toBe(200);
    });

    // Il 404 di NestJS sta in coda a tutto: deve continuare a funzionare, nel
    // formato del progetto, anche con rotte NestJS registrate. In
    // errorHandling.test.ts lo stesso caso è verificato senza controller
    // NestJS.
    it('una rotta inesistente risponde ancora 404 "Non trovato"', async () => {
      const res = await request(testApp.http).get('/__probe/non-esiste');

      expect(res.status).toBe(404);

      expect(res.body.error).toBe('Non trovato');
    });
  });

  describe('dependency injection', () => {
    // Prova end-to-end che i flag dei decoratori in tsconfig.json funzionano
    // anche sotto ts-jest, e che PrismaModule consegna il singleton condiviso.
    it('inietta PrismaClient, ed è la stessa istanza usata dal codice legacy', async () => {
      const res = await request(testApp.http).get('/__probe');

      expect(res.body.data).toEqual({ injected: true, sameInstanceAsLegacy: true });
    });
  });

  describe('ResponseEnvelopeInterceptor', () => {
    // Un controller NestJS restituisce il dato nudo; l'interceptor lo
    // avvolge nello stesso formato di res.success.
    it('avvolge il valore restituito nel formato del progetto', async () => {
      const res = await request(testApp.http).get('/__probe');

      expect(res.body).toEqual({
        success: true,
        status: 200,
        data: { injected: true, sameInstanceAsLegacy: true },
        message: '',
      });
    });

    // TRAPPOLA DOCUMENTATA PER F2: le POST NestJS rispondono 201 di default,
    // mentre POST /register e POST /login legacy rispondono 200. Migrandole
    // servirà @HttpCode(200) per non cambiare il contratto. Il test fissa
    // anche che lo status nell'involucro coincide con quello HTTP reale.
    it('su una POST riporta il 201 di default di NestJS, sia nell\'HTTP sia nell\'involucro', async () => {
      const res = await request(testApp.http).post('/__probe');

      expect(res.status).toBe(201);

      expect(res.body.status).toBe(201);
    });

    it('usa data: null quando il controller non restituisce nulla', async () => {
      const res = await request(testApp.http).get('/__probe/empty');

      expect(res.body.data).toBeNull();
    });
  });

  describe('AllExceptionsFilter', () => {
    // Un'eccezione HTTP lanciata da un controller arriva al client con il
    // suo status e il suo messaggio, nel formato di res.error.
    it('formatta un\'eccezione HTTP lanciata da un controller', async () => {
      const res = await request(testApp.http).get('/__probe/bad-request');

      expect(res.status).toBe(400);

      expect(res.body).toEqual({
        success: false,
        status: 400,
        data: null,
        error: 'Richiesta non valida',
      });
    });

    // Un errore imprevisto: 500, messaggio generico, dettaglio interno solo
    // nei log. Lo spy sull'istanza reale del logger (la stessa che il filter
    // ha ricevuto per iniezione) serve sia a verificare il log sia a non
    // sporcare backend/logs/ a ogni esecuzione della suite.
    it('risponde 500 generico a un errore imprevisto e lo logga senza esporlo', async () => {
      const logger = testApp.nest.get(WinstonLoggerService);

      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

      const res = await request(testApp.http).get('/__probe/crash');

      expect(res.status).toBe(500);

      expect(res.body.error).toBe('Qualcosa è andato storto!');

      expect(JSON.stringify(res.body)).not.toContain('dettaglio interno');

      expect(errorSpy).toHaveBeenCalledWith(
        'Errore:',
        expect.objectContaining({ message: 'dettaglio interno che non deve uscire' })
      );

      errorSpy.mockRestore();
    });
  });
});
