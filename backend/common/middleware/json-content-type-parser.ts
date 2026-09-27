import { BadRequestException } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';

/** Tipo di contenuto di cui questo parser si occupa. */
const JSON_CONTENT_TYPE = 'application/json';

/**
 * Installa il parser dei body JSON dell'applicazione, con la traduzione degli
 * errori di sintassi nel vocabolario del progetto.
 *
 * PERCHÉ NON SI USA QUELLO PREDEFINITO
 * Un body malformato deve produrre `400 "errore json: <dettaglio>"`, che fa
 * parte del contratto API (docs/API.md). Il parser di Fastify, come quello di
 * NestJS, produce un 400 con il messaggio grezzo di JSON.parse: il prefisso si
 * perderebbe. Tradurre qui, nel punto in cui l'errore nasce, evita di doverlo
 * riconoscere più a valle dal testo del messaggio, che sarebbe fragile.
 *
 * COM'ERA FINO ALLA FASE F6
 * Un middleware Express a quattro parametri montato subito dopo express.json()
 * (`common/middleware/json-syntax-error.middleware.ts`, rimosso): riconosceva
 * il SyntaxError del body parser e lo sostituiva. Serviva perché l'errore
 * originale andava perso prima di arrivare al filter. Con Fastify il punto di
 * intervento è più naturale: il parser è una funzione registrata, e l'errore
 * che passa a `done` diventa l'eccezione della richiesta.
 *
 * NOTA SULLE OPZIONI DELL'APP
 * Funziona solo con `bodyParser: false` (vedi NEST_APP_OPTIONS in
 * app.setup.ts): altrimenti NestJS registra il proprio parser JSON e Fastify
 * rifiuta l'avvio con "Content type parser 'application/json' already present"
 * — verificato.
 */
export function registerJsonContentTypeParser(fastify: FastifyInstance): void {
  // `parseAs: 'string'`: Fastify accumula il corpo e lo consegna come testo,
  // così il parsing (e il suo eventuale errore) resta nostro.
  fastify.addContentTypeParser(
    JSON_CONTENT_TYPE,
    { parseAs: 'string' },
    (_request, body, done) => {
      // Un body vuoto non è un errore di sintassi: è una richiesta senza dati,
      // e la ValidationPipe dirà quali campi mancano. JSON.parse('') invece
      // lancerebbe, e il client leggerebbe "errore json" per un body assente.
      if (typeof body !== 'string' || body.trim() === '') {
        return done(null, {});
      }

      try {
        done(null, JSON.parse(body));
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : String(error);

        done(new BadRequestException(`errore json: ${detail}`));
      }
    }
  );
}
