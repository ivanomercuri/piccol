// Come customerRoutes.test.ts, ma per il dominio /admin/user. Qui vale
// soprattutto la pena testare in HTTP reale il pattern di invalidazione del
// token (logout / cambio password): con un modello mockato non potremmo mai
// verificare che un vecchio JWT smetta davvero di funzionare dopo queste
// operazioni, perché "current_token" vive nel DB.
import jwt, { JwtPayload } from 'jsonwebtoken';
import request from 'supertest';
import { useTestApp } from './helpers/useTestApp';
import { prisma } from '../prisma/client';

// Avvio e chiusura dell'app NestJS, gestiti dall'helper. Chiamato qui, alla
// radice del file e fuori dal describe, perché la chiusura (che disconnette
// Prisma) avvenga sempre DOPO gli afterAll di pulizia del describe: vedi il
// commento in helpers/useTestApp.ts.
const testApp = useTestApp();

describe('Admin/User routes', () => {
  const emailsToClean: string[] = [];

  async function registerUser(name = 'Route Test User') {
    const email = `user-route-test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    emailsToClean.push(email);

    const res = await request(testApp.http)
      .post('/admin/user/register')
      .send({ name, email, password: 'password123' });

    return { email, token: res.body.data };
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emailsToClean } } });
  });

  describe('POST /admin/user/register', () => {
    it('should register a new admin user (default level) and return a JWT', async () => {
      const { token, email } = await registerUser();

      expect(typeof token).toBe('string');

      expect(token.split('.')).toHaveLength(3);

      // findUniqueOrThrow invece di findUnique: se la riga non esistesse, il
      // test deve fallire subito con un errore esplicito, non propagare un
      // null (findOne di Sequelize era tipizzato `any` e nascondeva il caso).
      const created = await prisma.user.findUniqueOrThrow({ where: { email } });

      expect(created.level).toBe('admin');
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(testApp.http).post('/admin/user/register').send({});

      expect(res.status).toBe(400);
    });

    // Verifica end-to-end, contro PostgreSQL vero, il comportamento che su
    // MySQL era garantito gratis dalla collation case-insensitive: ci si
    // registra con maiuscole e si fa login con minuscole (e viceversa).
    // È il test che si sarebbe rotto silenziosamente migrando il database
    // senza normalizzare l'email lato applicazione — e che su MySQL sarebbe
    // passato anche senza il codice di normalizzazione, quindi non avrebbe
    // segnalato nulla.
    it('should treat an email as the same identity regardless of case', async () => {
      const uniqueLocalPart = `case-test-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const mixedCaseEmail = `${uniqueLocalPart}@Example.COM`;
      const lowercaseEmail = `${uniqueLocalPart}@example.com`;

      emailsToClean.push(lowercaseEmail);

      const registerRes = await request(testApp.http)
        .post('/admin/user/register')
        .send({
          name: 'Case Test',
          email: mixedCaseEmail,
          password: 'password123',
        });

      expect(registerRes.status).toBe(200);

      // La riga salvata deve avere l'email normalizzata: cercarla nella
      // forma originale (con maiuscole) su PostgreSQL non la troverebbe.
      const created = await prisma.user.findUnique({ where: { email: lowercaseEmail } });

      expect(created).not.toBeNull();

      // Login con la forma minuscola, pur essendosi registrati con le
      // maiuscole: deve funzionare.
      const loginLower = await request(testApp.http)
        .post('/admin/user/login')
        .send({ email: lowercaseEmail, password: 'password123' });

      expect(loginLower.status).toBe(200);

      // E anche il percorso inverso: login con maiuscole su una riga salvata
      // in minuscolo, che è il caso reale più frequente (l'utente digita
      // l'email come gli pare al momento del login).
      const loginMixed = await request(testApp.http)
        .post('/admin/user/login')
        .send({ email: mixedCaseEmail, password: 'password123' });

      expect(loginMixed.status).toBe(200);
    });
  });

  describe('POST /admin/user/login', () => {
    it('should return a token for correct credentials', async () => {
      const { email } = await registerUser('Login Test');

      const res = await request(testApp.http)
        .post('/admin/user/login')
        .send({ email, password: 'password123' });

      expect(res.status).toBe(200);

      expect(typeof res.body.data).toBe('string');
    });

    it('should return 401 for a wrong password', async () => {
      const { email } = await registerUser('Wrong Password Test');

      const res = await request(testApp.http)
        .post('/admin/user/login')
        .send({ email, password: 'wrong-password' });

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Password errata');
    });
  });

  describe('protected routes (require a Bearer token)', () => {
    it('GET /admin/user should return 401 without a token', async () => {
      const res = await request(testApp.http).get('/admin/user');

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Token mancante');
    });

    it('GET /admin/user should return the profile with a valid token', async () => {
      const { token, email } = await registerUser('Profilo Test');

      const res = await request(testApp.http)
        .get('/admin/user')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      expect(res.body.data.email).toBe(email);

      expect(res.body.data.level).toBe('admin');
    });

    it('PATCH /admin/user should update name and email', async () => {
      const { token } = await registerUser('Da Aggiornare');

      const newEmail = `user-route-test-updated-${Date.now()}@example.com`;

      emailsToClean.push(newEmail);

      const res = await request(testApp.http)
        .patch('/admin/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aggiornato', email: newEmail });

      expect(res.status).toBe(200);

      expect(res.body.data.name).toBe('Aggiornato');

      expect(res.body.data.email).toBe(newEmail);
    });

    it('PATCH /admin/user/password should change the password and update login behavior accordingly', async () => {
      const { email, token } = await registerUser('Cambio Password');

      const changeRes = await request(testApp.http)
        .patch('/admin/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'password123', newPassword: 'newpassword456' });

      expect(changeRes.status).toBe(200);

      // La vecchia password non deve più funzionare al login...
      const oldLoginRes = await request(testApp.http)
        .post('/admin/user/login')
        .send({ email, password: 'password123' });

      expect(oldLoginRes.status).toBe(401);

      // ...quella nuova sì.
      const newLoginRes = await request(testApp.http)
        .post('/admin/user/login')
        .send({ email, password: 'newpassword456' });

      expect(newLoginRes.status).toBe(200);
    });

    it('PATCH /admin/user/password should return 400 if oldPassword is wrong', async () => {
      const { token } = await registerUser('Password Sbagliata');

      const res = await request(testApp.http)
        .patch('/admin/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'wrong', newPassword: 'newpassword456' });

      expect(res.status).toBe(400);

      expect(res.body.error).toBe('La vecchia password non corrisponde');
    });

    it('POST /admin/user/logout should invalidate the token for subsequent requests', async () => {
      const { token } = await registerUser('Logout Test');

      const logoutRes = await request(testApp.http)
        .post('/admin/user/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      // Lo stesso identico token, usato subito dopo il logout, deve essere
      // rifiutato: è il comportamento che rende possibile invalidare i
      // vecchi token, descritto in CLAUDE.md.
      const afterLogoutRes = await request(testApp.http)
        .get('/admin/user')
        .set('Authorization', `Bearer ${token}`);

      expect(afterLogoutRes.status).toBe(401);

      expect(afterLogoutRes.body.error).toBe('Token non più valido');
    });
  });

  // --- Fase F3: il dominio User è servito da NestJS ---
  //
  // Tutte le asserzioni sopra sono rimaste invariate: sono la prova che il
  // contratto non è cambiato passando dal middleware legacy ad AuthUserGuard
  // con passport. I test che seguono fissano i casi del guard che prima non
  // erano coperti end-to-end, e i comportamenti cambiati DI PROPOSITO.
  describe('F3: autenticazione con AuthUserGuard e comportamenti fissati', () => {
    // Il JWT_SECRET reale dell'ambiente di test: serve a costruire token
    // integri ma scaduti, o di utenti inesistenti, per arrivare ai controlli
    // successivi alla verifica della firma.
    const realSecret = process.env.JWT_SECRET as string;

    // Il collegamento fra la configurazione reale e JwtModule: la durata dei
    // token viene da JWT_EXPIRES_IN in .env ("1h" per questo progetto). Il
    // test che lo verificava stava in tokenService.test.ts, ridotto in F3.
    it('emette token che scadono secondo JWT_EXPIRES_IN', async () => {
      const { token } = await registerUser('Scadenza');

      const payload = jwt.decode(token) as JwtPayload;

      expect(process.env.JWT_EXPIRES_IN).toBe('1h');

      expect(payload.exp! - payload.iat!).toBe(3600);
    });

    it('rifiuta un header senza token con "Formato token non valido"', async () => {
      const res = await request(testApp.http).get('/admin/user').set('Authorization', 'Bearer');

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Formato token non valido');
    });

    // Cambio deliberato: il middleware legacy prendeva la seconda parola
    // dell'header qualunque fosse lo schema, quindi accettava anche un token
    // VALIDO inviato come "Basic <token>". Ora serve lo schema Bearer.
    it('rifiuta un token valido inviato con uno schema diverso da Bearer', async () => {
      const { token } = await registerUser('Schema Basic');

      const res = await request(testApp.http)
        .get('/admin/user')
        .set('Authorization', `Basic ${token}`);

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Formato token non valido');
    });

    // Firma corretta ma scadenza passata: rifiutato da passport-jwt prima di
    // arrivare al controllo su current_token.
    it('rifiuta un token scaduto con "Token scaduto o non valido"', async () => {
      const expired = jwt.sign(
        { id: 1, email: 'x@example.com', exp: Math.floor(Date.now() / 1000) - 60 },
        realSecret
      );

      const res = await request(testApp.http)
        .get('/admin/user')
        .set('Authorization', `Bearer ${expired}`);

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Token scaduto o non valido');
    });

    // Un token con la forma giusta ma firmato con un altro segreto: è il caso
    // di un token contraffatto.
    it('rifiuta un token firmato con un altro segreto', async () => {
      const forged = jwt.sign({ id: 1, email: 'x@example.com' }, 'segreto-sbagliato');

      const res = await request(testApp.http)
        .get('/admin/user')
        .set('Authorization', `Bearer ${forged}`);

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Token scaduto o non valido');
    });

    // Token integro e ancora valido, ma l'utente è stato cancellato.
    it('rifiuta il token di un utente cancellato con "Utente non trovato"', async () => {
      const { token, email } = await registerUser('Da Cancellare');

      await prisma.user.delete({ where: { email } });

      const res = await request(testApp.http)
        .get('/admin/user')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Utente non trovato');
    });

    // Sicurezza: profilo e aggiornamento non devono mai esporre l'hash della
    // password né il token corrente. Confronto sull'insieme esatto delle
    // chiavi, così un campo in più fa fallire il test.
    it('non espone password né current_token in lettura e aggiornamento del profilo', async () => {
      const { token } = await registerUser('Campi Pubblici');

      const auth = { Authorization: `Bearer ${token}` };

      const profile = await request(testApp.http).get('/admin/user').set(auth);

      const newEmail = `user-route-test-public-${Date.now()}@example.com`;

      emailsToClean.push(newEmail);

      const updated = await request(testApp.http)
        .patch('/admin/user')
        .set(auth)
        .send({ name: 'Campi Pubblici', email: newEmail });

      expect(Object.keys(profile.body.data).sort()).toEqual(['email', 'id', 'level', 'name']);

      expect(Object.keys(updated.body.data).sort()).toEqual(['email', 'id', 'name']);
    });

    // Sicurezza: un client non può registrarsi come superadmin. `level` non è
    // nel DTO, e la ValidationPipe lo scarta prima del service.
    it('ignora `level` in registrazione: ogni utente nasce admin', async () => {
      const email = `user-route-test-escalation-${Date.now()}@example.com`;

      emailsToClean.push(email);

      const res = await request(testApp.http)
        .post('/admin/user/register')
        .send({ name: 'Furbo', email, password: 'password123', level: 'superadmin' });

      expect(res.status).toBe(200);

      const created = await prisma.user.findUniqueOrThrow({ where: { email } });

      expect(created.level).toBe('admin');
    });

    // Contratto delle risposte senza dati: `data: {}` e il messaggio di
    // successo, impostato ora con @ResponseMessage.
    it('risponde con data {} e il messaggio di successo a cambio password e logout', async () => {
      const { token } = await registerUser('Messaggi');

      const auth = { Authorization: `Bearer ${token}` };

      const change = await request(testApp.http)
        .patch('/admin/user/password')
        .set(auth)
        .send({ oldPassword: 'password123', newPassword: 'nuovapassword1' });

      const logout = await request(testApp.http).post('/admin/user/logout').set(auth);

      expect(change.body).toEqual(
        expect.objectContaining({ data: {}, message: 'Password aggiornata con successo' })
      );

      expect(logout.body).toEqual(
        expect.objectContaining({ status: 200, data: {}, message: 'Logout effettuato con successo' })
      );
    });

    // Comportamento legacy CONSERVATO, e fissato perché non cambi per sbaglio:
    // dopo il cambio password il token già emesso resta valido. È una delle
    // decisioni aperte di F3; se verrà corretto, questo test andrà invertito.
    it('dopo il cambio password il token precedente resta valido (comportamento legacy)', async () => {
      const { token } = await registerUser('Token Dopo Cambio');

      const auth = { Authorization: `Bearer ${token}` };

      await request(testApp.http)
        .patch('/admin/user/password')
        .set(auth)
        .send({ oldPassword: 'password123', newPassword: 'nuovapassword1' });

      const res = await request(testApp.http).get('/admin/user').set(auth);

      expect(res.status).toBe(200);
    });

    // Bug corretto: un'email non stringa al login faceva esplodere la
    // normalizzazione con un 500.
    it('risponde 400, non 500, a un login con email non stringa', async () => {
      const res = await request(testApp.http)
        .post('/admin/user/login')
        .send({ email: 123, password: 'password123' });

      expect(res.status).toBe(400);
    });
  });
});