import dotenv from 'dotenv';
import path from 'path';

// Il caricamento di .env DEVE restare la prima istruzione del file, prima
// degli import dell'app: prisma/client.ts, tramite databaseUrl.ts, legge
// process.env nel momento stesso in cui viene importato, e lancia se una
// variabile manca. databaseUrl.ts carica .env anche da sé (gli serve per la
// CLI di Prisma), ma l'app non deve dipendere da quell'effetto collaterale
// nascosto dentro un altro modulo.
// TypeScript, compilando in CommonJS, emette i require nello stesso ordine
// in cui compaiono gli import, intervallati dalle istruzioni: questa riga
// viene quindi eseguita prima che app.module venga caricato.
//
// Il percorso: main.ts gira sempre compilato, da dist/main.js (sia con
// `npm run dev` sia con `npm start`), quindi da dist/ si risale di due
// livelli — backend/ e poi la radice del repo, dove vive .env accanto a
// docker-compose.yml. Dentro Docker il file non è montato e non viene
// trovato, senza conseguenze: le variabili arrivano già da env_file, e dotenv
// non sovrascrive mai quelle presenti. Serve come rete di sicurezza per
// un'esecuzione diretta sull'host.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import winstonLogger from './config/logger';
import { AppModule } from './app.module';
import { NEST_APP_OPTIONS, configureApp } from './app.setup';
import { WinstonLoggerService } from './common/logger/winston-logger.service';

/**
 * Avvio dell'applicazione. Sostituisce index.ts (che costruiva l'app
 * Express) e server.ts (che la metteva in ascolto).
 */
async function bootstrap(): Promise<void> {
  // FastifyAdapter: dalla fase F7 la piattaforma HTTP è Fastify, non più
  // Express (obiettivo "zero Express"). NestJS non è un server: delega a una
  // piattaforma, e questo è il punto in cui si sceglie quale.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    ...NEST_APP_OPTIONS,
    // I log prodotti durante la costruzione dell'app vengono trattenuti
    // finché useLogger() non registra l'adapter Winston, invece di finire sul
    // logger di default e perdersi da logs/.
    bufferLogs: true,
  });

  app.useLogger(app.get(WinstonLoggerService));

  // Fa arrivare SIGTERM/SIGINT (docker compose stop, Ctrl+C) agli hook
  // OnApplicationShutdown: è ciò che permette a PrismaModule di chiudere il
  // pool di connessioni in modo pulito. Senza, gli hook scattano solo con
  // una chiamata esplicita ad app.close().
  app.enableShutdownHooks();

  await configureApp(app);

  // PORT è già stata validata e convertita in numero da validateEnvironment:
  // getOrThrow resta come difesa esplicita, e comunica a chi legge che qui
  // un valore mancante non è un'eventualità prevista.
  const port = app.get(ConfigService).getOrThrow<number>('PORT');

  // '0.0.0.0' è necessario con Fastify: il suo default è 127.0.0.1, che dentro
  // un container non è raggiungibile dall'esterno. Express ascoltava su tutte
  // le interfacce per default, quindi fino a F6 non serviva dirlo.
  await app.listen(port, '0.0.0.0');
}

// Un errore di avvio (configurazione non valida, porta occupata) deve
// fermare il processo con un messaggio leggibile nei log, come faceva
// server.ts. Si usa Winston direttamente perché, se l'avvio fallisce, l'app
// — e quindi il logger registrato con useLogger — può non esistere.
bootstrap().catch((error: unknown) => {
  winstonLogger.error('Avvio fallito:', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  process.exit(1);
});
