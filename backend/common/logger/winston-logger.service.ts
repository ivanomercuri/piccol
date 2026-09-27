import { LoggerService } from '@nestjs/common';
import { inspect } from 'util';
import type { Logger } from 'winston';

type WinstonLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

/**
 * Adapter che fa scrivere a Winston anche i log di NestJS (decisione D10).
 *
 * Senza questo adapter il progetto avrebbe due sistemi di log paralleli: i
 * messaggi del framework (avvio, rotte registrate, errori interni) sulla
 * console tramite il ConsoleLogger di Nest, e quelli applicativi su Winston,
 * cioè in backend/logs/. Registrandolo con app.useLogger(), tutto finisce
 * nello stesso posto e nello stesso formato.
 *
 * PERCHÉ L'ISTANZA WINSTON ARRIVA DAL COSTRUTTORE
 * Si potrebbe importare direttamente config/logger.ts qui dentro, ma sarebbe
 * una dipendenza nascosta: esattamente il pattern che la migrazione sta
 * togliendo di mezzo (vedi §4.3 di docs/MIGRAZIONE-NESTJS.md). Ricevendo il
 * logger dal costruttore, la dipendenza è visibile nella firma e nei test si
 * passa un finto logger senza jest.mock sul sistema dei moduli. È AppModule
 * a costruire l'adapter con l'istanza reale.
 *
 * La classe non ha @Injectable() di proposito: non chiede nulla al container
 * di NestJS, viene creata con una factory che le passa l'istanza Winston.
 */
export class WinstonLoggerService implements LoggerService {
  constructor(private readonly winston: Logger) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(
    level: WinstonLevel,
    message: unknown,
    optionalParams: unknown[]
  ): void {
    this.winston.log(level, toText(message), toMetadata(optionalParams));
  }
}

/**
 * Converte i parametri aggiuntivi nel formato di metadati di Winston.
 *
 * NestJS chiama il logger con una convenzione posizionale, non con oggetti:
 * `log(messaggio, contesto)` ed `error(messaggio, stack, contesto)`, dove il
 * contesto è il nome della classe che scrive (es. "RoutesResolver"). Il
 * codice del progetto invece passa metadati strutturati, come fa
 * AllExceptionsFilter: `error('Errore:', { message, stack, path, method })`. Questa
 * funzione accetta entrambe le forme:
 *
 * - un oggetto viene fuso nei metadati così com'è;
 * - una stringa che contiene righe "    at ..." è uno stack trace;
 * - qualunque altra stringa è il contesto (vince l'ultima, come fa il
 *   ConsoleLogger di Nest).
 */
function toMetadata(optionalParams: unknown[]): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  for (const param of optionalParams) {
    if (typeof param === 'string') {
      if (looksLikeStackTrace(param)) {
        metadata.stack = param;
      } else {
        metadata.context = param;
      }
    } else if (isPlainObject(param)) {
      Object.assign(metadata, param);
    }
  }

  return metadata;
}

function looksLikeStackTrace(text: string): boolean {
  return /\n\s+at\s/.test(text);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * NestJS può loggare anche valori non stringa (oggetti, errori). Winston si
 * aspetta un messaggio testuale: util.inspect produce una rappresentazione
 * leggibile senza rischiare di lanciare su strutture circolari, come farebbe
 * JSON.stringify.
 */
function toText(message: unknown): string {
  return typeof message === 'string' ? message : inspect(message);
}
