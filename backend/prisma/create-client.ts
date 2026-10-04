import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/** Da cosa dipende un client Prisma di questo progetto. */
export interface PrismaClientOptions {
  /** Indirizzo completo del database (vedi config/databaseUrl.ts). */
  connectionString: string;
  /**
   * Se stampare ogni query eseguita. Va spento nella suite: parla con un
   * database reale e ogni query renderebbe illeggibile l'output di npm test.
   * Stessa scelta che models/index.ts faceva con config.logging.
   */
  logQueries: boolean;
}

/**
 * Costruisce un client Prisma. Unico punto del progetto in cui si chiama
 * `new PrismaClient`.
 *
 * PERCHÉ UNA FUNZIONE CHE RICEVE TUTTO
 * Non legge né l'ambiente né la configurazione: li riceve. Così lo stesso
 * codice serve due mondi che prendono i valori da fonti diverse —
 * `prisma/client.ts`, usato da chi gira fuori da NestJS (seed, CLI di Prisma,
 * test dei modelli), e `PrismaModule`, che dalla fase F8 li prende da
 * ConfigService dopo la validazione dell'ambiente. Senza questa funzione i
 * due mondi duplicherebbero adapter e politica di log, e prima o poi
 * divergerebbero.
 *
 * Prisma 7 richiede un driver adapter esplicito: il client "Rust-free" non
 * incorpora più il motore di connessione, quindi va detto quale driver usare
 * (qui `pg`, già dipendenza del progetto).
 */
export function createPrismaClient({
  connectionString,
  logQueries,
}: PrismaClientOptions): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: logQueries ? ['query'] : [],
  });
}
