import { defineConfig } from 'prisma/config';
import { buildDatabaseUrl } from './config/databaseUrl';

// Prisma 7 non accetta più `url` dentro il blocco datasource dello schema
// (errore P1012): la connessione va dichiarata qui.
//
// L'URL non viene letto da una variabile DATABASE_URL in .env ma composto
// dalle variabili già esistenti (DB_USER, DB_ROOT_PASSWORD, DB_HOST,
// DB_NAME): una stringa di connessione completa in .env sarebbe una seconda
// copia delle stesse credenziali, esattamente la duplicazione che il
// progetto ha eliminato nelle sessioni precedenti.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: buildDatabaseUrl(),
  },
});
