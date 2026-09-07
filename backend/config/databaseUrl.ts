import path from 'path';
import dotenv from 'dotenv';

// Carica .env dalla radice del repo, come fanno index.ts e config/config.js:
// questo modulo viene usato sia dall'app sia da prisma.config.ts, e
// quest'ultimo è eseguito dalla CLI di Prisma, fuori dal ciclo di vita
// dell'app — quindi non può dare per scontato che qualcun altro abbia già
// caricato le variabili.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * Compone la stringa di connessione PostgreSQL a partire dalle variabili
 * d'ambiente già esistenti, invece di introdurre una DATABASE_URL separata
 * in .env.
 *
 * Il motivo è la coerenza con una scelta già presa nel progetto: le
 * credenziali del database vivono in un punto solo (DB_USER,
 * DB_ROOT_PASSWORD, DB_NAME, condivise con docker-compose.yml). Una
 * DATABASE_URL completa in .env ne sarebbe una seconda copia, da tenere
 * allineata a mano ad ogni cambio password — lo stesso tipo di duplicazione
 * eliminata quando le credenziali erano ripetute fra compose e Sequelize.
 *
 * DB_HOST non è in .env ma nel blocco environment del servizio backend in
 * docker-compose.yml, perché è legato al nome del servizio nella rete
 * Docker, non a una scelta di configurazione.
 */
function buildDatabaseUrl(): string {
  // Nessun fallback, come per tutte le altre variabili del progetto: se una
  // manca, meglio fermarsi subito con un errore leggibile che tentare una
  // connessione con una stringa malformata e un errore criptico di pg.
  const required = ['DB_USER', 'DB_ROOT_PASSWORD', 'DB_HOST', 'DB_NAME'];

  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables required to build the database URL: ${missing.join(', ')}. Set them in .env before continuing.`
    );
  }

  const user = encodeURIComponent(process.env.DB_USER as string);
  // encodeURIComponent sulla password: un carattere come "@" o ":" spezzerebbe
  // il parsing della stringa di connessione. Non è un caso teorico, è la
  // ragione per cui le password vanno sempre codificate in una URL.
  const password = encodeURIComponent(process.env.DB_ROOT_PASSWORD as string);
  const host = process.env.DB_HOST as string;

  // Stessa regola che aveva config/config.js con i blocchi development/test:
  // la suite gira su un database separato, per non sporcare quello di
  // sviluppo popolato dal seed (vedi backend/docs/TESTING.md). È l'unica
  // differenza fra i due ambienti: host, utente e password sono gli stessi.
  const database =
    process.env.NODE_ENV === 'test'
      ? `${process.env.DB_NAME}_test`
      : (process.env.DB_NAME as string);

  // La porta è quella INTERNA del container PostgreSQL (sempre 5432), non
  // DB_HOST_PORT, che è la porta pubblicata sulla macchina host: da dentro
  // la rete Docker si raggiunge il servizio sulla sua porta interna.
  return `postgresql://${user}:${password}@${host}:5432/${database}`;
}

export { buildDatabaseUrl };
