import type { Server } from 'http';
import type { INestApplication, Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { NEST_APP_OPTIONS, configureApp } from '../../app.setup';

/**
 * Accesso all'app di test restituito da useTestApp.
 *
 * `http` è ciò che si passa a supertest: `request(testApp.http)`.
 * `nest` serve solo quando un test deve chiedere qualcosa al container, ad
 * esempio un provider su cui mettere uno spy: `testApp.nest.get(Classe)`.
 */
export interface TestApp {
  readonly nest: INestApplication;
  readonly http: Server;
}

interface TestAppOptions {
  /**
   * Controller aggiuntivi registrati solo per il test. Servono a
   * nestHosting.test.ts per verificare la convivenza fra rotte NestJS e
   * router legacy, senza aggiungere endpoint all'applicazione vera.
   */
  controllers?: Type<unknown>[];
}

/**
 * Avvia l'app NestJS per un file di test end-to-end e la chiude alla fine,
 * registrando da sé i due hook di Jest.
 *
 * VA CHIAMATA ALLA RADICE DEL FILE, FUORI DA OGNI describe:
 *
 *   const testApp = useTestApp();
 *
 *   describe('...', () => {
 *     afterAll(async () => {
 *       await prisma.user.deleteMany(...); // pulizia dei dati creati
 *     });
 *   });
 *
 * PERCHÉ ALLA RADICE
 * La chiusura dell'app disconnette Prisma, quindi deve avvenire DOPO la
 * pulizia dei dati che ogni file fa nel proprio afterAll. Jest esegue gli
 * afterAll di un describe prima di quelli alla radice del file (verificato),
 * quindi con questa posizione l'ordine giusto è garantito dalla STRUTTURA,
 * a prescindere dall'ordine in cui le righe vengono scritte.
 *
 * Il guasto che questo evita è subdolo. Dentro uno stesso blocco gli
 * afterAll girano nell'ordine di scrittura (verificato anche questo): se la
 * chiusura venisse scritta prima della pulizia, Prisma si RICONNETTEREBBE in
 * silenzio per eseguire la pulizia (verificato: una query dopo il disconnect
 * non dà errore), aprendo un pool che nessuno chiude più. Nessun test
 * fallirebbe; Jest resterebbe semplicemente appeso a fine esecuzione, senza
 * indicare quale file ne è la causa.
 *
 * È l'equivalente di ciò che KernelTestCase fa in Symfony: avvia il kernel e
 * lo spegne per conto tuo, e il test si occupa solo dei propri dati.
 */
export function useTestApp(options: TestAppOptions = {}): TestApp {
  // Vale undefined finché il beforeAll non ha girato, e resta undefined se
  // l'avvio fallisce (ad esempio per una variabile d'ambiente mancante).
  let nestApp: INestApplication | undefined;

  beforeAll(async () => {
    nestApp = await createTestApp(options);
  });

  afterAll(async () => {
    // `?.`: se l'avvio è fallito non c'è niente da chiudere, e un TypeError
    // qui ("cannot read properties of undefined") coprirebbe nei risultati di
    // Jest l'errore vero, quello dell'avvio.
    await nestApp?.close();
  });

  // PERCHÉ UN OGGETTO CON DEI GETTER, e non direttamente l'app o il server
  // Quando questa funzione ritorna, il beforeAll non ha ancora girato: l'app
  // non esiste. Restituire il valore vorrebbe dire consegnare undefined, per
  // sempre. I getter invece leggono `nestApp` nel momento in cui un test li
  // usa, cioè dopo il beforeAll.
  //
  // Si potrebbe restituire un oggetto vuoto riempito più tardi
  // (`{} as TestApp`), ma quel cast direbbe al compilatore una cosa falsa, e
  // un accesso troppo presto produrrebbe un undefined che esplode dentro
  // supertest con un messaggio incomprensibile. Il getter lo intercetta e
  // spiega il problema.
  //
  // Per chi viene da PHP 8: un getter in un oggetto letterale è una proprietà
  // che esegue codice quando viene letta — il ruolo di __get(), ma dichiarato
  // proprietà per proprietà e visibile al compilatore. In PHP 8.4 è ciò che
  // fanno i property hooks.
  return {
    get nest(): INestApplication {
      return requireStarted(nestApp);
    },
    get http(): Server {
      return requireStarted(nestApp).getHttpServer();
    },
  };
}

function requireStarted(
  nestApp: INestApplication | undefined
): INestApplication {
  if (!nestApp) {
    throw new Error(
      "useTestApp: l'app di test non è ancora avviata. testApp va usato " +
        'dentro un test o un hook, non al caricamento del file; e se lo è, ' +
        "controlla l'errore di avvio segnalato da Jest nel beforeAll."
    );
  }

  return nestApp;
}

/**
 * Costruisce l'app partendo dallo STESSO AppModule e applicando la STESSA
 * configureApp di main.ts, così i test attraversano la stessa catena della
 * produzione. Non va in ascolto su una porta: supertest usa direttamente il
 * server HTTP.
 *
 * Non è esportata di proposito: l'unico modo di ottenere un'app di test è
 * useTestApp, che ne gestisce anche la chiusura. Esportarla renderebbe di
 * nuovo possibile avviarne una e dimenticarsi di chiuderla.
 */
async function createTestApp(
  options: TestAppOptions
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
