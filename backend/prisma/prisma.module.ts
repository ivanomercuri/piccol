import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { composeDatabaseUrl } from '../config/databaseUrl';
import { createPrismaClient } from './create-client';

/**
 * Rende il client Prisma iniettabile nei provider NestJS (decisione D4).
 *
 * IL CLIENT LO COSTRUISCE IL CONTAINER (dalla fase F8)
 * Fino a F7 il provider consegnava con `useValue` il singleton esportato da
 * prisma/client.ts, costruito al momento dell'import di quel file. Funzionava,
 * ma legava l'avvio dell'applicazione all'ORDINE degli import: il client
 * leggeva process.env prima che esistesse un ConfigModule, quindi main.ts
 * doveva caricare .env con dotenv come primissima istruzione, e ConfigModule
 * poteva solo validare un ambiente già popolato da altri.
 *
 * Con `useFactory` + `inject: [ConfigService]` l'ordine lo impone il grafo
 * delle dipendenze invece di una convenzione da ricordare: NestJS costruisce
 * ConfigService (che carica e valida l'ambiente) e solo dopo può costruire il
 * client. Una variabile mancante produce quindi l'elenco completo di
 * config/env.validation.ts, non il primo errore incontrato.
 *
 * UNA SOLA ISTANZA PER PROCESSO
 * La guida di NestJS suggerisce una classe `PrismaService extends
 * PrismaClient`; qui il TOKEN di iniezione è la classe PrismaClient stessa, e
 * i provider la chiedono così:
 *
 *   constructor(private readonly prisma: PrismaClient) {}
 *
 * Funziona perché, con emitDecoratorMetadata attivo, il compilatore registra
 * che quel parametro è di tipo PrismaClient, e NestJS usa quella classe come
 * chiave per cercare il provider. Nei test basta
 * `{ provide: PrismaClient, useValue: finto }` per sostituirlo, senza
 * jest.mock sul modulo.
 *
 * Il client di prisma/client.ts continua a esistere per chi gira FUORI da
 * NestJS (seed, CLI di Prisma, test dei modelli). Non sono più la stessa
 * istanza: nello stesso processo possono coesistere solo se chi usa quella
 * fuori da Nest la chiude da sé, ed è quello che fanno i test dei modelli con
 * `$disconnect()` in afterAll. I test che avviano l'app usano invece il client
 * del container, esposto da `useTestApp()` come `testApp.prisma`.
 *
 * @Global(): il client serve a quasi tutti i moduli di dominio; senza, ognuno
 * dovrebbe importare PrismaModule. È una delle poche dipendenze per cui la
 * visibilità globale è la scelta normale.
 */
@Global()
@Module({
  providers: [
    {
      provide: PrismaClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PrismaClient =>
        createPrismaClient({
          // getOrThrow e non get: queste quattro variabili sono nel contratto
          // validato di env.validation.ts, quindi qui mancare non è
          // un'eventualità prevista. NODE_ENV invece è l'eccezione deliberata
          // del progetto (non fa parte del contratto), e si legge con get.
          connectionString: composeDatabaseUrl({
            user: config.getOrThrow<string>('DB_USER'),
            password: config.getOrThrow<string>('DB_ROOT_PASSWORD'),
            host: config.getOrThrow<string>('DB_HOST'),
            name: config.getOrThrow<string>('DB_NAME'),
            nodeEnv: config.get<string>('NODE_ENV'),
          }),
          logQueries: config.get<string>('NODE_ENV') !== 'test',
        }),
    },
  ],
  exports: [PrismaClient],
})
export class PrismaModule implements OnApplicationShutdown {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Chiude il pool di connessioni quando l'app si ferma: allo spegnimento del
   * container (grazie a enableShutdownHooks in main.ts) e a ogni
   * `app.close()` nei test. Senza, Jest resta appeso sul pool aperto.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
