// validateEnvironment in isolamento: riceve un oggetto di configurazione,
// senza leggere il vero process.env né il file .env.
import { validateEnvironment } from '../config/env.validation';

describe('validateEnvironment', () => {
  // Configurazione completa e valida. Tutti i valori sono stringhe perché
  // tutto ciò che arriva da process.env è stringa: la conversione è compito
  // della validazione, e i test devono partire dalla stessa condizione.
  const validConfig = {
    PORT: '5000',
    JWT_SECRET: 'segreto-di-test',
    JWT_EXPIRES_IN: '1h',
    DB_USER: 'postgres',
    DB_ROOT_PASSWORD: 'password',
    DB_HOST: 'db',
    DB_NAME: 'mydatabase',
  };

  // Caso base, e verifica della conversione: chi legge PORT dalla
  // configurazione validata (main.ts, con ConfigService) riceve un numero.
  it('accetta una configurazione completa e converte PORT in numero', () => {
    const result = validateEnvironment(validConfig);

    expect(result.PORT).toBe(5000);

    expect(result.JWT_SECRET).toBe('segreto-di-test');
  });

  // Il vantaggio rispetto ai controlli sparsi a livello di modulo, che si
  // fermano alla prima variabile mancante: qui un solo avvio fallito elenca
  // TUTTO ciò che va sistemato.
  it('elenca in un solo errore tutte le variabili mancanti, non solo la prima', () => {
    const incomplete: Record<string, unknown> = { ...validConfig };

    delete incomplete.JWT_SECRET;

    delete incomplete.DB_HOST;

    // Due asserzioni separate invece di una regex che le cerca entrambe: se
    // il test fallisce, il messaggio di Jest dice subito QUALE variabile
    // manca dall'elenco.
    expect(() => validateEnvironment(incomplete)).toThrow(/JWT_SECRET/);

    expect(() => validateEnvironment(incomplete)).toThrow(/DB_HOST/);
  });

  // Nessun fallback silenzioso: una stringa vuota non è un segreto valido.
  // È la politica del progetto (CLAUDE.md), qui applicata anche al caso
  // "variabile presente ma vuota", che un semplice controllo di esistenza
  // lascerebbe passare.
  it('rifiuta una variabile presente ma vuota', () => {
    expect(() => validateEnvironment({ ...validConfig, JWT_SECRET: '' })).toThrow(
      /JWT_SECRET/
    );
  });

  // PORT deve essere un intero valido: "abc" diventerebbe NaN e l'app
  // tenterebbe di mettersi in ascolto su una porta insensata.
  it('rifiuta una PORT non numerica o fuori intervallo', () => {
    expect(() => validateEnvironment({ ...validConfig, PORT: 'abc' })).toThrow(/PORT/);

    expect(() => validateEnvironment({ ...validConfig, PORT: '70000' })).toThrow(/PORT/);
  });

  // La validazione riceve l'intero process.env, che contiene decine di
  // variabili estranee all'app (PATH, HOME, ...): non devono farla fallire.
  it('ignora le variabili d\'ambiente che non fanno parte del contratto', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, PATH: '/usr/bin', HOME: '/home/node' })
    ).not.toThrow();
  });
});
