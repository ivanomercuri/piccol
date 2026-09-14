// Test end-to-end con supertest: qui non mockiamo nulla, la richiesta HTTP
// attraversa davvero l'app (express.json, ValidationPipe, CustomerController,
// CustomerAuthService, interceptor, filter) fino al DB di test reale. È
// l'unico modo per verificare che tutti questi pezzi, testati singolarmente
// altrove, funzionino anche insieme.
//
// Dalla fase F2 il dominio Customer è servito da NestJS invece che dal router
// Express legacy. Le asserzioni che c'erano prima sono rimaste invariate: sono
// la prova che il contratto visto dal client non è cambiato. I test aggiunti
// in fondo alle sezioni fissano invece i comportamenti cambiati DI PROPOSITO.
import request from 'supertest';
import { useTestApp } from './helpers/useTestApp';
import { prisma } from '../prisma/client';

// Avvio e chiusura dell'app NestJS, gestiti dall'helper. Chiamato qui, alla
// radice del file e fuori dal describe, perché la chiusura (che disconnette
// Prisma) avvenga sempre DOPO gli afterAll di pulizia del describe: vedi il
// commento in helpers/useTestApp.ts.
const testApp = useTestApp();

describe('Customer routes', () => {
  const emailsToClean: string[] = [];

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { email: { in: emailsToClean } } });
  });

  describe('GET /', () => {
    it('should respond with the health-check message', async () => {
      const res = await request(testApp.http).get('/');

      expect(res.status).toBe(200);

      expect(res.body.success).toBe(true);

      expect(res.body.data).toBe('𝕴𝖙 𝖂𝖔𝖗𝖐𝖘!');
    });
  });

  describe('POST /register', () => {
    it('should register a new customer and return a JWT', async () => {
      const email = `customer-route-test-${Date.now()}@example.com`;

      emailsToClean.push(email);

      const res = await request(testApp.http).post('/register').send({
        email,
        password: 'password123',
        firstName: 'Mario',
        lastName: 'Rossi',
        address: 'Via Roma 1',
      });

      expect(res.status).toBe(200);

      expect(typeof res.body.data).toBe('string');

      // Forma minima di un JWT: header.payload.firma
      expect(res.body.data.split('.')).toHaveLength(3);

      // Il token restituito deve essere anche quello salvato come
      // current_token sul record appena creato (pattern di invalidazione
      // descritto in CLAUDE.md).
      const created = await prisma.customer.findUniqueOrThrow({
        where: { email },
      });

      expect(created).not.toBeNull();

      expect(created.current_token).toBe(res.body.data);
    });

    it('should return 400 with grouped validation errors when required fields are missing', async () => {
      const res = await request(testApp.http).post('/register').send({});

      expect(res.status).toBe(400);

      expect(Array.isArray(res.body.error)).toBe(true);

      const fieldIds = res.body.error.map((e: { id: string }) => e.id);

      expect(fieldIds).toEqual(
        expect.arrayContaining([
          'email',
          'password',
          'firstName',
          'lastName',
          'address',
        ])
      );
    });

    it('should return 500 when registering with an email that already exists', async () => {
      // Comportamento conservato, non ovvio: il vincolo UNIQUE del database
      // arriva al filter come errore imprevisto e produce un 500, non un 409
      // "amichevole". Un 409 è una decisione aperta (docs/MIGRAZIONE-NESTJS.md,
      // fase F2). Cambiato invece il MESSAGGIO: prima era il testo grezzo
      // dell'errore del database, ora è generico (vedi l'asserzione in fondo).
      const email = `customer-route-test-dup-${Date.now()}@example.com`;

      emailsToClean.push(email);

      const payload = {
        email,
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        address: 'X',
      };

      await request(testApp.http).post('/register').send(payload);

      const res = await request(testApp.http).post('/register').send(payload);

      expect(res.status).toBe(500);

      expect(res.body.success).toBe(false);

      // Il dettaglio interno (nomi di colonne, testo dell'errore Prisma) non
      // deve più arrivare al client: resta solo nei log.
      expect(res.body.error).toBe('Qualcosa è andato storto!');
    });

    // --- Comportamenti cambiati o fissati in F2 ---

    // Un campo mancante viola sia "è richiesto" sia il formato: il client
    // deve ricevere il messaggio utile, "è richiesta", e il formato solo
    // quando il valore c'è ma è sbagliato.
    it('distingue un\'email mancante da un\'email malformata', async () => {
      const missing = await request(testApp.http).post('/register').send({});

      const malformed = await request(testApp.http)
        .post('/register')
        .send({ email: 'non-una-email' });

      const messageFor = (body: { error: { id: string; message: string }[] }) =>
        body.error.find((e) => e.id === 'email')?.message;

      expect(messageFor(missing.body)).toBe('Email è richiesta');

      expect(messageFor(malformed.body)).toBe('Email non valida');
    });

    // Prima un valore non stringa superava la validazione legacy e faceva
    // esplodere il codice più avanti con un 500. Ora è un errore del client.
    it('risponde 400 a un campo testuale che non è una stringa', async () => {
      const res = await request(testApp.http).post('/register').send({
        email: `tipo-sbagliato-${Date.now()}@example.com`,
        password: 12345678,
        firstName: 'A',
        lastName: 'B',
        address: 'X',
      });

      expect(res.status).toBe(400);

      expect(res.body.error).toEqual([
        { id: 'password', message: 'Password deve essere un testo' },
      ]);
    });

    // Anche senza nessun body (nemmeno `{}`) la risposta deve essere un 400
    // con gli errori per campo, non un errore interno.
    it('risponde 400 con gli errori per campo anche se il body manca del tutto', async () => {
      const res = await request(testApp.http).post('/register');

      expect(res.status).toBe(400);

      expect(Array.isArray(res.body.error)).toBe(true);
    });

    // Difesa dal "mass assignment": campi non previsti dal DTO, come `id` o
    // `current_token`, non devono arrivare al database. Se `current_token`
    // passasse, un client potrebbe impostare un token a propria scelta sul
    // proprio account.
    it('ignora i campi non previsti, come id e current_token', async () => {
      const email = `customer-route-test-extra-${Date.now()}@example.com`;

      emailsToClean.push(email);

      const res = await request(testApp.http).post('/register').send({
        email,
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        address: 'X',
        id: 999999,
        current_token: 'scelto-dal-client',
      });

      expect(res.status).toBe(200);

      const created = await prisma.customer.findUniqueOrThrow({ where: { email } });

      expect(created.id).not.toBe(999999);

      expect(created.current_token).toBe(res.body.data);
    });
  });

  describe('POST /login', () => {
    const email = `customer-route-login-test-${Date.now()}@example.com`;

    beforeAll(async () => {
      emailsToClean.push(email);

      await request(testApp.http).post('/register').send({
        email,
        password: 'password123',
        firstName: 'Login',
        lastName: 'Test',
        address: 'Via Test 1',
      });
    });

    it('should return a token for correct credentials', async () => {
      const res = await request(testApp.http)
        .post('/login')
        .send({ email, password: 'password123' });

      expect(res.status).toBe(200);

      expect(typeof res.body.data).toBe('string');
    });

    it('should return 401 for a wrong password', async () => {
      const res = await request(testApp.http)
        .post('/login')
        .send({ email, password: 'wrong-password' });

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Password errata');
    });

    it('should return 401 for a non-existent email', async () => {
      const res = await request(testApp.http)
        .post('/login')
        .send({ email: `nobody-${Date.now()}@example.com`, password: 'x' });

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Utente non trovato');
    });

    // --- Comportamento cambiato in F2 ---

    // Bug corretto: con un'email non stringa il login legacy chiamava
    // toLowerCase() su un numero, esplodeva e rispondeva 500.
    it('risponde 400, non 500, a un\'email che non è una stringa', async () => {
      const res = await request(testApp.http)
        .post('/login')
        .send({ email: 123, password: 'password123' });

      expect(res.status).toBe(400);

      expect(res.body.error).toEqual([
        { id: 'email', message: 'Email deve essere un testo' },
      ]);
    });
  });
});