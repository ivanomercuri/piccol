// Gestione degli errori a livello di APPLICAZIONE, non di singola funzione.
//
// Perché questo file esiste separato da errorMiddleware.test.ts: quel file
// chiama errorMiddleware direttamente, passandogli un finto err/req/res, e
// quindi verifica soltanto *cosa fa la funzione*. Non può accorgersi se la
// funzione non viene mai invocata, perché bypassa completamente il dispatch
// di Express. Ed è esattamente lì che stava il bug corretto in questa fase:
// Express riconosce un middleware come error-handler solo se dichiara
// ESATTAMENTE 4 parametri (err, req, res, next), ed errorMiddleware ne
// dichiarava 3 — quindi `app.use(errorMiddleware)` lo registrava come un
// normale middleware che non veniva mai chiamato su next(err).
//
// La lezione che questo file incorpora: un test che verifica il
// comportamento di un'unità in isolamento non dice nulla sul fatto che
// quell'unità sia collegata. Per il wiring serve una richiesta HTTP vera.
//
// Non tocca il database, ma importa l'app intera (che istanzia il Prisma
// Client): serve comunque il $disconnect in afterAll, altrimenti Jest resta
// appeso sul pool di connessioni aperto.
import request from 'supertest';
import app from '../index';
import { prisma } from '../prisma/client';

describe('Gestione errori a livello di app', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('body JSON malformato', () => {
    // express.json() lancia un SyntaxError con .status 400 e una proprietà
    // `body` prima che la richiesta raggiunga qualsiasi route handler.
    // Quell'errore deve arrivare a errorMiddleware e uscire nel formato
    // standard del progetto (res.error), non come pagina HTML di default di
    // Express — che oltretutto esporrebbe uno stack trace in sviluppo.
    //
    // La rotta scelta è irrilevante (il body non viene mai parsato con
    // successo, quindi non si arriva al controller): serve solo che sia una
    // POST esistente.
    it('risponde 400 nel formato del progetto, non con la pagina HTML di Express', async () => {
      const res = await request(app)
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
      const res = await request(app)
        .post('/admin/user/login')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(400);

      // Errore di validazione: `error` è l'array raggruppato per campo
      // prodotto da validationHandlerMiddleware, non la stringa "errore json:".
      expect(Array.isArray(res.body.error)).toBe(true);
    });
  });

  describe('rotte inesistenti', () => {
    // noPathMiddleware è montato prima di errorMiddleware: una 404 non è un
    // errore propagato con next(err) e non deve quindi passare dal gestore
    // degli errori. Verificato qui perché la correzione dell'arità cambia
    // quali middleware sono raggiungibili, e questo non deve regredire.
    it('risponde 404 nel formato del progetto', async () => {
      const res = await request(app).get('/questa-rotta-non-esiste');

      expect(res.status).toBe(404);

      expect(res.body.success).toBe(false);

      expect(res.body.error).toBe('Non trovato');
    });
  });
});
