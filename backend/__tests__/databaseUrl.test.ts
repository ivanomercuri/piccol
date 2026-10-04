// La composizione dell'indirizzo del database, in isolamento.
//
// composeDatabaseUrl è una funzione pura (nessuna lettura di process.env),
// quindi si verifica passandole i valori: è il motivo per cui è stata
// separata da buildDatabaseUrl, che invece legge l'ambiente.
import { buildDatabaseUrl, composeDatabaseUrl } from '../config/databaseUrl';

describe('composeDatabaseUrl', () => {
  const credenziali = {
    user: 'postgres',
    password: 'segreta',
    host: 'db',
    name: 'mydatabase',
  };

  // Forma di base: schema, credenziali, host, porta interna del container
  // PostgreSQL (sempre 5432, mai DB_HOST_PORT) e nome del database.
  it('compone l\'indirizzo nella forma attesa', () => {
    expect(composeDatabaseUrl(credenziali)).toBe(
      'postgresql://postgres:segreta@db:5432/mydatabase'
    );
  });

  // Il suffisso _test è l'UNICA differenza fra gli ambienti: host, utente e
  // password restano gli stessi. È ciò che impedisce alla suite di toccare il
  // database di sviluppo popolato dal seed.
  it('aggiunge il suffisso _test al nome del database quando NODE_ENV è test', () => {
    expect(composeDatabaseUrl({ ...credenziali, nodeEnv: 'test' })).toBe(
      'postgresql://postgres:segreta@db:5432/mydatabase_test'
    );
  });

  // Qualunque altro ambiente (o nessuno) lascia il nome intatto: il suffisso
  // non deve comparire per sbaglio in sviluppo o in produzione.
  it.each(['development', 'production', undefined])(
    'non tocca il nome del database con NODE_ENV %s',
    (nodeEnv) => {
      expect(composeDatabaseUrl({ ...credenziali, nodeEnv })).toContain('/mydatabase');

      expect(composeDatabaseUrl({ ...credenziali, nodeEnv })).not.toContain('_test');
    }
  );

  // Il caso per cui la codifica esiste: una password con "@" o ":" spezzerebbe
  // il parsing dell'indirizzo, e pg finirebbe per cercare un host inesistente.
  it('codifica i caratteri speciali di utente e password', () => {
    const url = composeDatabaseUrl({
      ...credenziali,
      user: 'utente@azienda',
      password: 'p@ss:w/ord',
    });

    expect(url).toBe('postgresql://utente%40azienda:p%40ss%3Aw%2Ford@db:5432/mydatabase');

    // La controprova che conta: dopo la codifica, l'host che un parser di URL
    // legge è ancora quello giusto.
    expect(new URL(url).hostname).toBe('db');
  });
});

describe('buildDatabaseUrl', () => {
  // Legge l'ambiente del processo: la suite gira con NODE_ENV=test e le
  // variabili del container, quindi l'indirizzo punta al database di test.
  it('compone l\'indirizzo dalle variabili d\'ambiente', () => {
    expect(buildDatabaseUrl()).toBe(
      composeDatabaseUrl({
        user: process.env.DB_USER as string,
        password: process.env.DB_ROOT_PASSWORD as string,
        host: process.env.DB_HOST as string,
        name: process.env.DB_NAME as string,
        nodeEnv: process.env.NODE_ENV,
      })
    );
  });

  // Politica "nessun fallback": meglio fermarsi con un errore leggibile che
  // tentare la connessione con una stringa malformata. L'errore elenca TUTTE
  // le variabili mancanti, non solo la prima.
  it('elenca le variabili mancanti invece di comporre un indirizzo monco', () => {
    const originali = { user: process.env.DB_USER, host: process.env.DB_HOST };

    delete process.env.DB_USER;

    delete process.env.DB_HOST;

    try {
      expect(() => buildDatabaseUrl()).toThrow(/DB_USER, DB_HOST/);
    } finally {
      process.env.DB_USER = originali.user;

      process.env.DB_HOST = originali.host;
    }
  });
});
