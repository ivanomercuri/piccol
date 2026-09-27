import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { prisma as sharedPrismaClient } from './client';

/**
 * Rende il client Prisma iniettabile nei provider NestJS (decisione D4).
 *
 * UNA SOLA ISTANZA PER PROCESSO
 * La guida di NestJS suggerisce una classe `PrismaService extends
 * PrismaClient`, che però creerebbe una SECONDA istanza del client accanto a
 * quella esportata da prisma/client.ts — cioè un secondo pool di connessioni
 * a PostgreSQL. AGENTS.md lo vieta esplicitamente, e durante la migrazione i
 * router legacy continuano a usare il singleton: con due istanze, codice
 * legacy e codice NestJS parlerebbero con il database da due pool diversi.
 *
 * Qui invece il container riceve la stessa identica istanza (`useValue`), e
 * il TOKEN di iniezione è la classe PrismaClient stessa. Un provider NestJS
 * la chiede così:
 *
 *   constructor(private readonly prisma: PrismaClient) {}
 *
 * Funziona perché, con emitDecoratorMetadata attivo, il compilatore registra
 * che quel parametro è di tipo PrismaClient, e NestJS usa quella classe come
 * chiave per cercare il provider. Nei test basterà
 * `{ provide: PrismaClient, useValue: finto }` per sostituirlo, senza
 * jest.mock sul modulo.
 *
 * Gli script di seed continuano a importare prisma/client.ts direttamente:
 * girano fuori da NestJS e non devono caricare il framework.
 *
 * @Global(): il client serve a quasi tutti i moduli di dominio che nasceranno
 * da F2 in poi; senza @Global ognuno dovrebbe importare PrismaModule. È una
 * delle poche dipendenze per cui la visibilità globale è la scelta normale.
 */
@Global()
@Module({
  providers: [{ provide: PrismaClient, useValue: sharedPrismaClient }],
  exports: [PrismaClient],
})
export class PrismaModule implements OnApplicationShutdown {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Chiude il pool di connessioni quando l'app si ferma: allo spegnimento del
   * container (grazie a enableShutdownHooks in main.ts) e a ogni
   * `app.close()` nei test. È ciò che prima i test end-to-end facevano a mano
   * con `prisma.$disconnect()` — senza, Jest resta appeso sul pool aperto.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
