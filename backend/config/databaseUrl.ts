// NESSUN EFFETTO COLLATERALE ALL'IMPORT (dalla fase F8). Fino a F7 questo
// file chiamava dotenv.config() a livello di modulo, quindi importarlo
// significava caricare .env: comodo, ma era un caricamento nascosto dentro un
// modulo di libreria, e l'ordine degli import diventava parte del
// funzionamento. Ora chi ha bisogno del file lo dice (config/loadEnvFile.ts).

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
/** Le quattro credenziali da cui si compone l'indirizzo del database. */
export interface DatabaseCredentials {
  user: string;
  password: string;
  host: string;
  name: string;
  /**
   * Il valore di NODE_ENV: decide SOLO il suffisso `_test` sul nome del
   * database. È un parametro e non una lettura di process.env perché questa
   * funzione non deve sapere da dove arrivano i valori.
   */
  nodeEnv?: string;
}

/**
 * Compone l'indirizzo del database a partire da valori già noti.
 *
 * PERCHÉ UNA FUNZIONE PURA, SEPARATA DA buildDatabaseUrl
 * Qui sta la FORMA dell'indirizzo (schema, codifica, porta, suffisso di test);
 * in buildDatabaseUrl sta invece la PROVENIENZA dei valori, cioè process.env.
 * Separarle permette di comporre lo stesso identico indirizzo partendo da
 * un'altra fonte — è ciò che fa PrismaModule, che prende i valori da
 * ConfigService quando il container di NestJS è già pronto, invece di leggere
 * l'ambiente al momento dell'import.
 *
 * Una funzione pura (stesso input, stesso output, nessun effetto collaterale)
 * si verifica anche senza toccare l'ambiente del processo.
 */
export function composeDatabaseUrl({
  user,
  password,
  host,
  name,
  nodeEnv,
}: DatabaseCredentials): string {
  // Stessa regola che aveva config/config.js con i blocchi development/test:
  // la suite gira su un database separato, per non sporcare quello di
  // sviluppo popolato dal seed (vedi backend/docs/TESTING.md). È l'unica
  // differenza fra i due ambienti: host, utente e password sono gli stessi.
  const database = nodeEnv === 'test' ? `${name}_test` : name;

  // encodeURIComponent su utente e password: un carattere come "@" o ":"
  // spezzerebbe il parsing della stringa di connessione. Non è un caso
  // teorico, è la ragione per cui le credenziali vanno sempre codificate in
  // una URL.
  //
  // La porta è quella INTERNA del container PostgreSQL (sempre 5432), non
  // DB_HOST_PORT, che è la porta pubblicata sulla macchina host: da dentro
  // la rete Docker si raggiunge il servizio sulla sua porta interna.
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${database}`;
}

/**
 * L'indirizzo del database a partire da process.env.
 *
 * Lo usano i programmi che girano FUORI dal container di NestJS, e che quindi
 * non hanno un ConfigService da cui attingere: `prisma.config.ts` (eseguito
 * dalla CLI di Prisma per migrate, db push e generate), gli script di seed e
 * `prisma/client.ts`.
 */
function buildDatabaseUrl(): string {
  // Nessun fallback, come per tutte le altre variabili del progetto: se una
  // manca, meglio fermarsi subito con un errore leggibile che tentare una
  // connessione con una stringa malformata e un errore criptico di pg.
  //
  // Nota: dentro l'applicazione NestJS questo controllo non scatta più per
  // primo, perché il client Prisma lo costruisce il container dopo la
  // validazione dell'ambiente. Qui resta per chi gira fuori da Nest.
  const required = ['DB_USER', 'DB_ROOT_PASSWORD', 'DB_HOST', 'DB_NAME'];

  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables required to build the database URL: ${missing.join(', ')}. Set them in .env before continuing.`
    );
  }

  return composeDatabaseUrl({
    user: process.env.DB_USER as string,
    password: process.env.DB_ROOT_PASSWORD as string,
    host: process.env.DB_HOST as string,
    name: process.env.DB_NAME as string,
    nodeEnv: process.env.NODE_ENV,
  });
}

export { buildDatabaseUrl };
