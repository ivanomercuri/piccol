import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildDatabaseUrl } from '../config/databaseUrl';

/**
 * Istanza condivisa del Prisma Client: sostituisce models/index.ts, il
 * loader che scansionava la cartella models/ e collegava a mano le
 * associazioni. Con Prisma quel meccanismo non serve più — lo schema
 * (prisma/schema.prisma) è l'unica fonte di verità e il client tipizzato è
 * generato da lì.
 *
 * A differenza del vecchio `db` (un Record<string, any> che costringeva
 * ogni consumer a lavorare su modelli non tipizzati), qui ogni delegate
 * — prisma.user, prisma.product, ... — è tipizzato con precisione, campo per
 * campo, senza bisogno di alcun cast.
 */

// Prisma 7 richiede un driver adapter esplicito: il client "Rust-free" non
// incorpora più il motore di connessione, quindi va detto quale driver
// usare (qui `pg`, già dipendenza del progetto).
const adapter = new PrismaPg({ connectionString: buildDatabaseUrl() });

// In test il logging delle query è disattivato: la suite parla con un
// database reale e ogni query stampata renderebbe illeggibile l'output di
// npm test. Stessa scelta che models/index.ts faceva con config.logging.
const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'test' ? [] : ['query'],
});

export { prisma };
