// Sequelize CLI esegue questo file con `node` puro, fuori dalla pipeline
// ts-node dell'app (vedi CHECKPOINT.md: config/, migrations/ e seeders/
// restano deliberatamente .js, non transpilati) — quindi carica .env "a
// mano" invece di affidarsi al fatto che qualcun altro l'abbia già fatto.
// Il percorso esplicito serve perché questo file vive due livelli sotto la
// radice del repo (backend/config/), a differenza di backend/index.ts che
// ne è solo un livello sotto.
require('dotenv').config({
  path: require('path').resolve(__dirname, '..', '..', '.env'),
});

// Nessun fallback: sono le credenziali reali del database. Un default
// silenzioso qui significherebbe che Sequelize CLI (o l'app) potrebbero
// provare a connettersi con una password diversa da quella realmente
// impostata sul server PostgreSQL (vedi POSTGRES_PASSWORD in
// docker-compose.yml, stessa variabile) — meglio un errore immediato e
// leggibile, sia in fase di CLI (migrate/seed) sia all'avvio dell'app.
if (!process.env.DB_ROOT_PASSWORD) {
  throw new Error(
    'Missing DB_ROOT_PASSWORD environment variable. Set it in .env before continuing.'
  );
}

// Nuova rispetto alla configurazione MySQL: là l'utente era implicitamente
// "root", qui è il ruolo PostgreSQL creato dal container (POSTGRES_USER in
// docker-compose.yml) e deve coincidere con quello, altrimenti la
// connessione viene rifiutata.
if (!process.env.DB_USER) {
  throw new Error(
    'Missing DB_USER environment variable. Set it in .env before continuing.'
  );
}

if (!process.env.DB_NAME) {
  throw new Error(
    'Missing DB_NAME environment variable. Set it in .env before continuing.'
  );
}

const DB_ROOT_PASSWORD = process.env.DB_ROOT_PASSWORD;
const DB_USER = process.env.DB_USER;
const DB_NAME = process.env.DB_NAME;

module.exports = {
  development: {
    username: DB_USER,
    password: DB_ROOT_PASSWORD,
    database: DB_NAME,
    host: 'db',
    dialect: 'postgres',
  },
  // Stesso host/credenziali di development: solo il nome del database
  // cambia, per isolare il DB di test da quello di sviluppo già popolato
  // dal seed (vedi backend/docs/TESTING.md).
  test: {
    username: DB_USER,
    password: DB_ROOT_PASSWORD,
    database: `${DB_NAME}_test`,
    host: 'db',
    dialect: 'postgres',
  },
};
