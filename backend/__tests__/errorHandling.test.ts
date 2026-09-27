// Gestione degli errori a livello di APPLICAZIONE, non di singola funzione.
//
// Nato nella fase F0 per dimostrare il bug di arità di errorMiddleware (3
// parametri invece dei 4 che Express conta per riconoscere un gestore
// d'errore, quindi mai invocato). La lezione che questo file incorpora resta
// valida: un test che verifica un'unità in isolamento non dice nulla sul
// fatto che quell'unità sia collegata. Per il wiring serve una richiesta HTTP
// vera.
//
// Dalla fase F1 errorMiddleware e noPathMiddleware non esistono più: il loro
// compito è passato ad AllExceptionsFilter (common/filters/), aiutato da
// jsonSyntaxErrorMiddleware per il caso del JSON malformato. Le asserzioni
// qui sotto NON sono cambiate — è proprio questo il punto: il contratto
// visto dal client deve restare identico mentre l'implementazione passa da
// Express a NestJS, e questo file è ciò che lo dimostra.
import request from 'supertest';
import { useTestApp } from './helpers/useTestApp';

// Avvio e chiusura dell'app NestJS, gestiti dall'helper. Chiamato qui, alla
// radice del file e fuori dal describe, perché la chiusura (che disconnette
// Prisma) avvenga sempre DOPO gli afterAll di pulizia del describe: vedi il
// commento in helpers/useTestApp.ts.
const testApp = useTestApp();

describe('Gestione errori a livello di app', () => {
  describe('body JSON malformato', () => {
    // express.json() lancia un SyntaxError con .status 400 e una proprietà
    // `body` prima che la richiesta raggiunga qualsiasi route handler.
    // Percorso dalla fase F1: jsonSyntaxErrorMiddleware lo traduce in una
    // BadRequestException con il messaggio "errore json: ...", NestJS la
    // rilancia nel proprio sistema di filtri e AllExceptionsFilter la formatta.
    // Il risultato deve restare quello del formato standard del progetto, non
    // la pagina HTML di default di Express — che oltretutto esporrebbe uno
    // stack trace in sviluppo.
    //
    // La rotta scelta è irrilevante (il body non viene mai parsato con
    // successo, quindi non si arriva al controller): serve solo che sia una
    // POST esistente.
    it('risponde 400 nel formato del progetto, non con la pagina HTML di Express', async () => {
      const res = await request(testApp.http)
        .post('/admin/user/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "rotto"');

      expect(res.status).toBe(400);

      // Queste tre asserzioni sono il cuore del test: prima della correzione
      // dell'arità lo status era comunque 400 (lo imposta body-parser
      // sull'errore, e il gestore di default di Express lo rispetta), ma il
      // body era HTML. Asserire solo sullo status non avrebbe rilevato nulla.
      expect(res.body.success).toBe(false);

      expect(res.body.status).toBe(400);

      expect(res.body.data).toBeNull();

      expect(res.body.error).toMatch(/^errore json: /);
    });

    // Controprova: un body JSON valido sulla stessa rotta non deve passare
    // dal ramo di errore. Serve a escludere che il test sopra passi per un
    // motivo sbagliato (es. una risposta 400 prodotta dalla validazione dei
    // campi invece che dal parsing del body).
    it('un body JSON valido ma incompleto arriva alla validazione, non al gestore JSON', async () => {
      const res = await request(testApp.http)
        .post('/admin/user/login')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(400);

      // Errore di validazione: `error` è l'array raggruppato per campo
      // prodotto dalla ValidationPipe globale, non la stringa "errore json:".
      expect(Array.isArray(res.body.error)).toBe(true);
    });

    // Presidio della scelta di tenere disattivato il parser di NestJS (commento
    // di NEST_APP_OPTIONS in app.setup.ts): l'app registra solo il proprio
    // parser JSON, quindi un body di form non ha chi lo legga.
    //
    // COMPORTAMENTO CAMBIATO NELLA FASE F7: la risposta è 415 "Tipo di contenuto
    // non supportato" invece del 400 con gli errori di validazione. Fastify
    // rifiuta un tipo di contenuto senza parser prima di eseguire la rotta,
    // mentre Express lasciava il body vuoto e la richiesta arrivava alla
    // validazione. Il 415 dice al client qual è davvero il problema.
    //
    // Se qualcuno attivasse il parser di NestJS (che include i body di form), il
    // contratto si allargherebbe in silenzio: questo test lo renderebbe visibile.
    it('non legge i body application/x-www-form-urlencoded', async () => {
      const res = await request(testApp.http)
        .post('/admin/user/login')
        .type('form')
        .send({ email: 'qualcuno@example.com', password: 'password' });

      expect(res.status).toBe(415);

      expect(res.body.error).toBe('Tipo di contenuto non supportato');
    });
  });

  describe('rotte inesistenti', () => {
    // Dalla fase F1 la 404 la produce il gestore di NestJS in coda all'app,
    // con un messaggio inglese ("Cannot GET /..."): è AllExceptionsFilter a
    // riconoscerla e a sostituirlo con "Non trovato". Questo test è anche il
    // presidio di quel riconoscimento, che dipende dal formato esatto del
    // messaggio di NestJS: se una versione futura lo cambiasse, fallirebbe qui.
    it('risponde 404 nel formato del progetto', async () => {
      const res = await request(testApp.http).get('/questa-rotta-non-esiste');

      expect(res.status).toBe(404);

      expect(res.body.success).toBe(false);

      expect(res.body.error).toBe('Non trovato');
    });

    // Comportamento cambiato di proposito nella fase F5 (decisione D8):
    // GET /routes, la rotta di debug che elencava le rotte dietro
    // SHOW_ROUTES, è stata cancellata e non portata a NestJS. Ora è una rotta
    // inesistente come le altre, a prescindere dal valore di SHOW_ROUTES.
    it('GET /routes non esiste più', async () => {
      const res = await request(testApp.http).get('/routes');

      expect(res.status).toBe(404);

      expect(res.body.error).toBe('Non trovato');
    });
  });
});
