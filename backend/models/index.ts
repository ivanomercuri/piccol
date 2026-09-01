import fs from 'fs';
import path from 'path';
import { Sequelize, Options, DataTypes } from 'sequelize';
// require() invece di import: config.js è un file .js CommonJS eseguito
// anche da Sequelize CLI fuori dalla pipeline ts-node (vedi .sequelizerc),
// e legge da .env con la propria chiamata a dotenv — non un modulo TS
// tipizzato da importare in modo statico.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const configFile = require('../config/config.js');

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';

// Cast esplicito: config.js non garantisce a livello di tipi che `dialect`
// sia esattamente il literal `"mysql"` richiesto da Sequelize (resta un
// generico `string` per TypeScript, dato che require() di un file .js non
// tipizzato risolve a `any`), quindi il cast è necessario — il valore reale
// a runtime è invariato rispetto al file .js originale.
// `use_env_variable` non fa parte di `Options` (è una convenzione di
// sequelize-cli, non della classe Sequelize): il blocco attuale di
// config.js non la usa, ma il ramo sotto la gestisce comunque per
// generalità, come nel file .js originale.
const config = (configFile as Record<string, Options & { use_env_variable?: string }>)[
  env
];

// `db` resta un dizionario "any": contiene sia i modelli caricati
// dinamicamente qui sotto (le cui classi vivono nei rispettivi file .ts,
// già tipizzati singolarmente) sia le chiavi speciali `sequelize`/
// `Sequelize`. Tipizzarlo con precisione richiederebbe enumerare
// staticamente ogni modello, esattamente ciò che questo loader dinamico
// esiste per evitare (vedi CLAUDE.md: "i nuovi modelli vanno semplicemente
// aggiunti in quella directory") — impostazione voluta, non una svista.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: Record<string, any> = {};

// In test disattiviamo il logging SQL di Sequelize: con la nuova suite di
// test che parla con un DB reale (models/*.model.test.js, routes/*.test.js),
// lasciare console.log qui sommergerebbe l'output di `npm test` con ogni
// singola query eseguita, rendendo illeggibili i risultati dei test.
config.logging = env === 'test' ? false : console.log;

let sequelize: Sequelize;

if (config.use_env_variable) {
  sequelize = new Sequelize(
    process.env[config.use_env_variable] as string,
    config
  );
} else {
  sequelize = new Sequelize(
    config.database as string,
    config.username as string,
    config.password,
    config
  );
}

fs.readdirSync(__dirname)
  .filter((file) => {
    // Durante la migrazione incrementale a TypeScript (vedi CHECKPOINT.md),
    // i modelli già convertiti sono file .ts: il filtro accetta entrambe le
    // estensioni finché la migrazione non è completa.
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      (file.slice(-3) === '.js' || file.slice(-3) === '.ts') &&
      file.indexOf('.test.js') === -1 &&
      file.indexOf('.d.ts') === -1
    );
  })
  .forEach((file) => {
    // require() dinamico e necessario qui: il set di file da caricare è
    // scoperto a runtime scansionando la cartella (fs.readdirSync sopra),
    // non è noto staticamente — non esiste un equivalente `import` che
    // possa sostituirlo senza perdere l'auto-discovery (dynamic import()
    // restituirebbe una Promise, rendendo asincrono un loader che deve
    // restare sincrono per come viene consumato da tutto il resto del
    // progetto).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const model = require(path.join(__dirname, file))(sequelize, DataTypes);

    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;

db.Sequelize = Sequelize;

export = db;