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

// Fallback identici ai valori finora hardcoded qui dentro: se le variabili
// mancano dall'ambiente (es. .env non ancora popolato), il comportamento
// resta quello di sempre invece di rompersi in silenzio.
const DB_ROOT_PASSWORD = process.env.DB_ROOT_PASSWORD || 'rootpassword';
const DB_NAME = process.env.DB_NAME || 'mydatabase';

module.exports = {
  development: {
    username: 'root',
    password: DB_ROOT_PASSWORD,
    database: DB_NAME,
    host: 'db',
    dialect: 'mysql',
  },
  // Stesso host/credenziali di development: solo il nome del database
  // cambia, per isolare il DB di test da quello di sviluppo già popolato
  // dal seed (vedi backend/docs/TESTING.md).
  test: {
    username: 'root',
    password: DB_ROOT_PASSWORD,
    database: `${DB_NAME}_test`,
    host: 'db',
    dialect: 'mysql',
  },
};
