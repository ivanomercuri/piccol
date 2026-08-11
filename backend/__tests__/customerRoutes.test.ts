// Test end-to-end con supertest: qui non mockiamo nulla, la richiesta HTTP
// attraversa davvero index.ts (responseFormatter, express.json, il router
// customer, express-validator, il controller, i services, il modello) fino
// al DB di test reale. È l'unico modo per verificare che tutti questi pezzi,
// testati singolarmente altrove, funzionino anche insieme.
import request from 'supertest';
import app from '../index';
import models from '../models';

const { Customer, sequelize } = models;

describe('Customer routes', () => {
  const emailsToClean: string[] = [];

  afterAll(async () => {
    await Customer.destroy({ where: { email: emailsToClean } });

    await sequelize.close();
  });

  describe('GET /', () => {
    it('should respond with the health-check message', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);

      expect(res.body.success).toBe(true);

      expect(res.body.data).toBe('𝕴𝖙 𝖂𝖔𝖗𝖐𝖘!');
    });
  });

  describe('POST /register', () => {
    it('should register a new customer and return a JWT', async () => {
      const email = `customer-route-test-${Date.now()}@example.com`;

      emailsToClean.push(email);

      const res = await request(app).post('/register').send({
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
      const created = await Customer.findOne({ where: { email } });

      expect(created).not.toBeNull();

      expect(created.current_token).toBe(res.body.data);
    });

    it('should return 400 with grouped validation errors when required fields are missing', async () => {
      const res = await request(app).post('/register').send({});

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
      // Comportamento attuale, non ovvio: il vincolo UNIQUE a livello DB
      // arriva come eccezione generica al controller, che risponde 500 con
      // il messaggio grezzo di Sequelize, non un 400 "amichevole" — vedi
      // backend/docs/API.md.
      const email = `customer-route-test-dup-${Date.now()}@example.com`;

      emailsToClean.push(email);

      const payload = {
        email,
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        address: 'X',
      };

      await request(app).post('/register').send(payload);

      const res = await request(app).post('/register').send(payload);

      expect(res.status).toBe(500);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /login', () => {
    const email = `customer-route-login-test-${Date.now()}@example.com`;

    beforeAll(async () => {
      emailsToClean.push(email);

      await request(app).post('/register').send({
        email,
        password: 'password123',
        firstName: 'Login',
        lastName: 'Test',
        address: 'Via Test 1',
      });
    });

    it('should return a token for correct credentials', async () => {
      const res = await request(app)
        .post('/login')
        .send({ email, password: 'password123' });

      expect(res.status).toBe(200);

      expect(typeof res.body.data).toBe('string');
    });

    it('should return 401 for a wrong password', async () => {
      const res = await request(app)
        .post('/login')
        .send({ email, password: 'wrong-password' });

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Password errata');
    });

    it('should return 401 for a non-existent email', async () => {
      const res = await request(app)
        .post('/login')
        .send({ email: `nobody-${Date.now()}@example.com`, password: 'x' });

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Utente non trovato');
    });
  });
});