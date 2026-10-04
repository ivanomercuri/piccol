import { buildDatabaseUrl } from '../config/databaseUrl';
import { loadEnvFile } from '../config/loadEnvFile';
import { createPrismaClient } from './create-client';

// Chi importa questo file gira fuori da NestJS e non ha un ConfigModule che
// abbia caricato .env: lo carica qui, prima di comporre l'indirizzo.
loadEnvFile();

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

// L'istanza è costruita qui, all'import: è ciò che distingue questo file dal
// client dell'applicazione. Chi lo importa gira FUORI dal container di NestJS
// (seed, CLI di Prisma, test dei modelli) e non ha un ConfigService da cui
// attingere, quindi i valori arrivano da process.env tramite
// buildDatabaseUrl().
//
// L'app invece NON passa da qui: dalla fase F8 il suo client lo costruisce
// PrismaModule con i valori validati di ConfigService. Erano la stessa istanza
// fino a F7, ma quella condivisione era anche la ragione per cui il
// caricamento di .env doveva avvenire prima di qualunque import.
const prisma = createPrismaClient({
  connectionString: buildDatabaseUrl(),
  logQueries: process.env.NODE_ENV !== 'test',
});

export { prisma };
