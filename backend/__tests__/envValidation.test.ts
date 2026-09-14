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
    MAX_FILE_SIZE: '3',
    MAX_FILE_HARD_SIZE: '10',
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

  // Regressione del bug trovato in F1: con `MAX_FILE_SIZE=3# in MB` in .env,
  // Docker Compose passava al container la stringa "3# in MB", e il codice
  // legacy funzionava solo perché parseInt si fermava al primo carattere non
  // numerico. Ora un valore del genere ferma l'avvio invece di essere
  // interpretato a metà.
  it('rifiuta un limite di upload con un commento in linea, come "3# in MB"', () => {
    expect(() => validateEnvironment({ ...validConfig, MAX_FILE_SIZE: '3# in MB' })).toThrow(
      /MAX_FILE_SIZE/
    );
  });

  // Un limite di business superiore a quello hard non potrebbe mai scattare:
  // multer interromperebbe prima l'upload.
  it('rifiuta MAX_FILE_SIZE maggiore di MAX_FILE_HARD_SIZE', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, MAX_FILE_SIZE: '20', MAX_FILE_HARD_SIZE: '10' })
    ).toThrow(/MAX_FILE_SIZE must not exceed MAX_FILE_HARD_SIZE/);
  });

  // La validazione riceve l'intero process.env, che contiene decine di
  // variabili estranee all'app (PATH, HOME, ...): non devono farla fallire.
  it('ignora le variabili d\'ambiente che non fanno parte del contratto', () => {
    expect(() =>
      validateEnvironment({ ...validConfig, PATH: '/usr/bin', HOME: '/home/node' })
    ).not.toThrow();
  });
});
