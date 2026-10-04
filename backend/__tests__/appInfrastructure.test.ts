// Infrastruttura trasversale dell'app, verificata con richieste HTTP reali:
// dependency injection, involucro delle risposte, gestione degli errori, 404.
//
// Il file registra un controller di prova visibile SOLO in questo test
// (tramite l'opzione `controllers` di useTestApp): serve a far lanciare
// errori controllati e a osservare l'iniezione, senza aggiungere endpoint
// all'app vera. È nato in F1, quando l'app non aveva ancora controller
// NestJS veri.
//
// Fino alla fase F4 si chiamava nestHosting.test.ts e verificava anche la
// convivenza fra router Express legacy e rotte NestJS: su uno stesso metodo e
// percorso vinceva il router legacy, montato prima (§9 di
// docs/MIGRAZIONE-NESTJS.md). Quel test è sparito in F5 con l'ultimo router
// legacy: non c'è più nulla con cui una rotta NestJS possa entrare in
// conflitto.
import { BadRequestException, Controller, Get, Post } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import { CurrentUser } from '../modules/auth/current-user.decorator';
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
      // Il token PrismaClient è stato risolto con un client vero, non con un
      // oggetto qualsiasi: `$connect` esiste solo su un PrismaClient.
      isPrismaClient: typeof this.prisma.$connect === 'function',
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

  // Errore di programmazione voluto: @CurrentUser() su una rotta SENZA
  // @UseGuards(AuthUserGuard). Nessuno ha popolato request.user.
  @Get('current-user-without-guard')
  currentUserWithoutGuard(@CurrentUser() user: unknown) {
    return user;
  }
}

// Avvio e chiusura gestiti dall'helper, alla radice del file (vedi
// helpers/useTestApp.ts). Il controller di prova esiste solo in quest'app.
const testApp = useTestApp({ controllers: [ProbeController] });

describe('Infrastruttura trasversale dell\'app', () => {
  describe('404', () => {
    // Il gestore 404 di NestJS sta in coda a tutto: una rotta inesistente
    // sotto un prefisso che ESISTE (quello del controller di prova) deve
    // comunque arrivarci, nel formato del progetto. In errorHandling.test.ts
    // lo stesso caso è verificato su un percorso qualsiasi.
    it('una rotta inesistente risponde 404 "Non trovato"', async () => {
      const res = await request(testApp.http).get('/__probe/non-esiste');

      expect(res.status).toBe(404);

      expect(res.body.error).toBe('Non trovato');
    });
  });

  describe('dependency injection', () => {
    // Prova end-to-end che i flag dei decoratori in tsconfig.json funzionano
    // anche sotto ts-jest: senza emitDecoratorMetadata NestJS passerebbe
    // undefined al costruttore SENZA dare errore.
    it('inietta un PrismaClient vero risolvendo il token', async () => {
      const res = await request(testApp.http).get('/__probe');

      expect(res.body.data).toEqual({ injected: true, isPrismaClient: true });
    });

    // Il provider è costruito una volta sola: chi chiede il token riceve
    // sempre lo stesso client, quindi un solo pool di connessioni per
    // processo. Dalla fase F8 quell'istanza la costruisce il container con i
    // valori di ConfigService, e NON è più quella di prisma/client.ts, che
    // resta per chi gira fuori da NestJS (seed, CLI, test dei modelli).
    it('consegna sempre la stessa istanza, anche a chi la chiede dal container', () => {
      expect(testApp.nest.get(PrismaClient)).toBe(testApp.prisma);
    });
  });

  describe('ResponseEnvelopeInterceptor', () => {
    // Un controller NestJS restituisce il dato nudo; l'interceptor lo
    // avvolge nel formato del progetto (docs/API.md).
    it('avvolge il valore restituito nel formato del progetto', async () => {
      const res = await request(testApp.http).get('/__probe');

      expect(res.body).toEqual({
        success: true,
        status: 200,
        data: { injected: true, isPrismaClient: true },
        message: '',
      });
    });

    // TRAPPOLA DA RICORDARE: le POST NestJS rispondono 201 di default, mentre
    // il contratto del progetto per POST /register, /login e /products/new è
    // 200 (ereditato dalle rotte Express). Una nuova POST che deve rispondere
    // 200 ha bisogno di @HttpCode(200). Il test fissa anche che lo status
    // nell'involucro coincide con quello HTTP reale.
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
    // suo status e il suo messaggio, nel formato d'errore del progetto.
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

  describe('@CurrentUser()', () => {
    // Usato su una rotta non protetta, il decoratore non deve restituire
    // undefined facendo proseguire il controller con un utente inesistente:
    // deve fallire. È un bug del codice, non del client, quindi 500 e non 401.
    it('su una rotta senza AuthUserGuard fallisce con un 500 invece di proseguire', async () => {
      const logger = testApp.nest.get(WinstonLoggerService);

      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

      const res = await request(testApp.http).get('/__probe/current-user-without-guard');

      expect(res.status).toBe(500);

      expect(errorSpy).toHaveBeenCalledWith(
        'Errore:',
        expect.objectContaining({ message: expect.stringContaining('AuthUserGuard') })
      );

      errorSpy.mockRestore();
    });
  });
});
