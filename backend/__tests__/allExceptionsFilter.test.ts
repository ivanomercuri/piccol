// AllExceptionsFilter in isolamento: nessuna app, nessun database.
//
// Eredita i casi del vecchio errorMiddleware.test.ts (rimosso in F1 insieme
// al middleware), aggiornati dove la regola è cambiata deliberatamente:
// - "logga sempre" diventa "logga solo i 5xx";
// - "risponde con err.message" diventa "un errore imprevisto non fa mai
//   trapelare il proprio messaggio".
// Il collegamento reale del filter all'app è verificato invece da
// errorHandling.test.ts e appInfrastructure.test.ts, con richieste HTTP vere.
//
// Dalla fase F7 il filter non parla più direttamente alla risposta: passa
// dall'adapter HTTP di NestJS, l'astrazione che gli permette di funzionare su
// Express come su Fastify. Qui l'adapter è finto, e le asserzioni guardano che
// cosa gli viene chiesto di inviare.
import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AbstractHttpAdapter, HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';

describe('AllExceptionsFilter', () => {
  let logger: { error: jest.Mock };
  let filter: AllExceptionsFilter;
  let adapter: {
    reply: jest.Mock;
    getRequestUrl: jest.Mock;
    getRequestMethod: jest.Mock;
    isHeadersSent: jest.Mock;
  };

  // Oggetti opachi: il filter non legge nulla da loro, li passa all'adapter.
  const request = { finta: 'richiesta' };
  const response = { finta: 'risposta' };

  // Costruisce l'ArgumentsHost minimo che il filter usa: switchToHttp() con
  // request e response. È l'astrazione con cui NestJS passa il contesto di
  // esecuzione, indipendente dal tipo di trasporto (HTTP, WebSocket, ecc.).
  function host(): ArgumentsHost {
    return {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;
  }

  // L'involucro che il filter ha chiesto di inviare, e con quale status.
  function sent(): { status: number; body: { error: unknown; [key: string]: unknown } } {
    const [, body, status] = adapter.reply.mock.calls[0];

    return { status, body };
  }

  beforeEach(() => {
    logger = { error: jest.fn() };

    adapter = {
      reply: jest.fn(),
      getRequestUrl: jest.fn().mockReturnValue('/prodotti/42'),
      getRequestMethod: jest.fn().mockReturnValue('GET'),
      isHeadersSent: jest.fn().mockReturnValue(false),
    };

    // Logger e adapter arrivano dal costruttore: bastano oggetti finti, senza
    // jest.mock sui moduli. È il vantaggio concreto della dipendenza esplicita.
    filter = new AllExceptionsFilter(logger as unknown as WinstonLoggerService, {
      httpAdapter: adapter as unknown as AbstractHttpAdapter,
    } as HttpAdapterHost);
  });

  // Il caso più comune in futuro: un controller lancia un'eccezione HTTP con
  // un messaggio pensato per il client. Status e messaggio arrivano intatti,
  // dentro l'involucro standard del progetto.
  it('risponde con status e messaggio di una HttpException, nel formato del progetto', () => {
    filter.catch(new ForbiddenException('Non autorizzato'), host());

    // La risposta viene inviata tramite l'adapter, con l'oggetto risposta
    // ricevuto dal contesto: è il punto in cui il filter resta indipendente
    // dalla piattaforma.
    expect(adapter.reply).toHaveBeenCalledWith(
      response,
      { success: false, status: 403, data: null, error: 'Non autorizzato' },
      403
    );
  });

  // Regola di sicurezza introdotta in F1. Il vecchio errorMiddleware
  // rispondeva con err.message anche per errori imprevisti: il testo di un
  // errore del database o di un bug sarebbe arrivato al client. Qui il
  // messaggio interno deve restare nei log e non comparire MAI nella risposta.
  it('per un errore imprevisto risponde 500 con un messaggio generico, senza far trapelare il dettaglio interno', () => {
    const internal = new Error('relation "users" does not exist');

    filter.catch(internal, host());

    expect(sent().status).toBe(500);

    expect(sent().body.error).toBe('Qualcosa è andato storto!');

    expect(JSON.stringify(sent().body)).not.toContain('relation');
  });

  // Contropartita del test sopra: il dettaglio tolto al client deve
  // arrivare ai log, completo di stack e di contesto della richiesta — con la
  // stessa forma di metadati che usava res.error, così i log restano
  // confrontabili con quelli di prima della migrazione.
  it('logga gli errori 5xx con messaggio, stack, percorso e metodo', () => {
    const internal = new Error('connessione rifiutata');

    filter.catch(internal, host());

    expect(logger.error).toHaveBeenCalledWith('Errore:', {
      message: 'connessione rifiutata',
      stack: internal.stack,
      path: '/prodotti/42',
      method: 'GET',
    });
  });

  // I 4xx sono errori del client e fanno parte del funzionamento normale
  // (validazione, token scaduto): loggarli come errori annegherebbe quelli
  // veri. Stessa politica che aveva res.error, che loggava solo nei rami
  // catch.
  it('non logga gli errori 4xx', () => {
    filter.catch(new BadRequestException('Email non valida'), host());

    expect(logger.error).not.toHaveBeenCalled();
  });

  // Anche un throw di un valore che non è un Error (throw 'stringa') deve
  // produrre un 500 pulito e un log leggibile, non far esplodere il filter
  // leggendo .message su una stringa.
  it('gestisce anche un valore lanciato che non è un Error', () => {
    filter.catch('qualcosa di strano', host());

    expect(sent().status).toBe(500);

    expect(logger.error).toHaveBeenCalledWith(
      'Errore:',
      expect.objectContaining({ message: 'qualcosa di strano', stack: undefined })
    );
  });

  // Il 404 prodotto da NestJS quando nessuna rotta corrisponde ha un
  // messaggio inglese, "Cannot <METODO> <URL>": deve diventare "Non trovato",
  // come faceva noPathMiddleware.
  it('traduce il 404 di "rotta inesistente" di NestJS in "Non trovato"', () => {
    const unmatched = new NotFoundException('Cannot GET /prodotti/42');

    filter.catch(unmatched, host());

    expect(sent().status).toBe(404);

    expect(sent().body.error).toBe('Non trovato');
  });

  // Il riconoscimento di sopra non deve inghiottire le 404 lanciate di
  // proposito dai controller: "Prodotto non trovato" è un'informazione utile
  // al client e va conservata. È il motivo per cui il confronto è sul
  // messaggio esatto, URL compreso, e non su "qualunque NotFoundException".
  it('conserva il messaggio di una NotFoundException lanciata da un controller', () => {
    filter.catch(new NotFoundException('Prodotto non trovato'), host());

    expect(sent().body.error).toBe('Prodotto non trovato');
  });

  // Le eccezioni costruite con un oggetto (come quelle della ValidationPipe
  // dalla fase F2) hanno { message, error, statusCode }: al client arriva
  // solo `message`, anche quando è un array — il contratto di docs/API.md
  // prevede che `error` possa essere un array.
  it('estrae `message` da una risposta a oggetto, anche quando è un array', () => {
    const exception = new BadRequestException(['name è richiesto', 'email è richiesta']);

    filter.catch(exception, host());

    expect(sent().body.error).toEqual([
      'name è richiesto',
      'email è richiesta',
    ]);
  });

  // Una HttpException 5xx lanciata apposta (es. un servizio esterno giù) è
  // una scelta del codice, non un incidente: il suo messaggio è pensato per
  // il client e resta. Viene comunque loggata, perché è pur sempre un 5xx.
  it('conserva il messaggio di una HttpException 5xx lanciata di proposito, e la logga', () => {
    filter.catch(
      new ServiceUnavailableException('Pagamenti momentaneamente non disponibili'),
      host()
    );

    expect(sent().body.error).toBe('Pagamenti momentaneamente non disponibili');

    expect(logger.error).toHaveBeenCalled();
  });

  // Se la risposta è già partita, un secondo invio lancerebbe "Cannot set
  // headers after they are sent" DENTRO il gestore degli errori. Il filter
  // deve limitarsi a loggare (se grave) e fermarsi.
  it('non tenta un secondo invio se la risposta è già partita', () => {
    adapter.isHeadersSent.mockReturnValue(true);

    filter.catch(new Error('dopo l\'invio'), host());

    expect(adapter.reply).not.toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalled();
  });
});
