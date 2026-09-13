// WinstonLoggerService in isolamento, con un finto logger Winston passato al
// costruttore. Verifica la traduzione fra le due convenzioni di chiamata:
// quella posizionale di NestJS e quella a metadati del progetto.
import type { Logger } from 'winston';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';

describe('WinstonLoggerService', () => {
  let winston: { log: jest.Mock };
  let service: WinstonLoggerService;

  beforeEach(() => {
    winston = { log: jest.fn() };

    service = new WinstonLoggerService(winston as unknown as Logger);
  });

  // NestJS chiama log(messaggio, contesto): il contesto è il nome della
  // classe che scrive, e deve finire nei metadati invece di perdersi.
  it('mappa log(messaggio, contesto) di NestJS su info con il contesto nei metadati', () => {
    service.log('Nest application successfully started', 'NestApplication');

    expect(winston.log).toHaveBeenCalledWith('info', 'Nest application successfully started', {
      context: 'NestApplication',
    });
  });

  // Per gli errori NestJS passa error(messaggio, stack, contesto): lo stack
  // va riconosciuto come tale e non scambiato per il contesto.
  it('riconosce lo stack trace in error(messaggio, stack, contesto)', () => {
    const stack = 'Error: boom\n    at Object.<anonymous> (/app/main.ts:1:1)';

    service.error('boom', stack, 'ExceptionHandler');

    expect(winston.log).toHaveBeenCalledWith('error', 'boom', {
      stack,
      context: 'ExceptionHandler',
    });
  });

  // La convenzione del progetto (res.error, AllExceptionsFilter): metadati
  // strutturati in un oggetto, che devono arrivare a Winston così come sono.
  it('fonde nei metadati un oggetto passato come parametro', () => {
    service.error('Errore:', { path: '/products', method: 'GET' });

    expect(winston.log).toHaveBeenCalledWith('error', 'Errore:', {
      path: '/products',
      method: 'GET',
    });
  });

  // NestJS può loggare anche valori non testuali: non devono far esplodere
  // l'adapter, e diventano una rappresentazione leggibile.
  it('converte in testo un messaggio che non è una stringa', () => {
    service.warn({ modulo: 'Prisma' });

    expect(winston.log).toHaveBeenCalledWith('warn', expect.stringContaining('Prisma'), {});
  });

  // Ogni metodo dell'interfaccia LoggerService arriva al livello Winston
  // corrispondente: un errore di mappatura qui farebbe sparire (o gonfiare)
  // intere categorie di log senza alcun segnale.
  it('instrada ogni metodo al livello Winston corrispondente', () => {
    service.debug('d');

    service.verbose('v');

    expect(winston.log.mock.calls.map((call) => call[0])).toEqual(['debug', 'verbose']);
  });
});
