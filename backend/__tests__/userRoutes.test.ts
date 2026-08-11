// Come customerRoutes.test.ts, ma per il dominio /admin/user. Qui vale
// soprattutto la pena testare in HTTP reale il pattern di invalidazione del
// token (logout / cambio password): con un modello mockato non potremmo mai
// verificare che un vecchio JWT smetta davvero di funzionare dopo queste
// operazioni, perché "current_token" vive nel DB.
import request from 'supertest';
import app from '../index';
import models from '../models';

const { User, sequelize } = models;

describe('Admin/User routes', () => {
  const emailsToClean: string[] = [];

  async function registerUser(name = 'Route Test User') {
    const email = `user-route-test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    emailsToClean.push(email);

    const res = await request(app)
      .post('/admin/user/register')
      .send({ name, email, password: 'password123' });

    return { email, token: res.body.data };
  }

  afterAll(async () => {
    await User.destroy({ where: { email: emailsToClean } });

    await sequelize.close();
  });

  describe('POST /admin/user/register', () => {
    it('should register a new admin user (default level) and return a JWT', async () => {
      const { token, email } = await registerUser();

      expect(typeof token).toBe('string');

      expect(token.split('.')).toHaveLength(3);

      const created = await User.findOne({ where: { email } });

      expect(created.level).toBe('admin');
    });

    it('should return 400 when required fields are missing', async () => {
      const res = await request(app).post('/admin/user/register').send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /admin/user/login', () => {
    it('should return a token for correct credentials', async () => {
      const { email } = await registerUser('Login Test');

      const res = await request(app)
        .post('/admin/user/login')
        .send({ email, password: 'password123' });

      expect(res.status).toBe(200);

      expect(typeof res.body.data).toBe('string');
    });

    it('should return 401 for a wrong password', async () => {
      const { email } = await registerUser('Wrong Password Test');

      const res = await request(app)
        .post('/admin/user/login')
        .send({ email, password: 'wrong-password' });

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Password errata');
    });
  });

  describe('protected routes (require a Bearer token)', () => {
    it('GET /admin/user should return 401 without a token', async () => {
      const res = await request(app).get('/admin/user');

      expect(res.status).toBe(401);

      expect(res.body.error).toBe('Token mancante');
    });

    it('GET /admin/user should return the profile with a valid token', async () => {
      const { token, email } = await registerUser('Profilo Test');

      const res = await request(app)
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

      const res = await request(app)
        .patch('/admin/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Aggiornato', email: newEmail });

      expect(res.status).toBe(200);

      expect(res.body.data.name).toBe('Aggiornato');

      expect(res.body.data.email).toBe(newEmail);
    });

    it('PATCH /admin/user/password should change the password and update login behavior accordingly', async () => {
      const { email, token } = await registerUser('Cambio Password');

      const changeRes = await request(app)
        .patch('/admin/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'password123', newPassword: 'newpassword456' });

      expect(changeRes.status).toBe(200);

      // La vecchia password non deve più funzionare al login...
      const oldLoginRes = await request(app)
        .post('/admin/user/login')
        .send({ email, password: 'password123' });

      expect(oldLoginRes.status).toBe(401);

      // ...quella nuova sì.
      const newLoginRes = await request(app)
        .post('/admin/user/login')
        .send({ email, password: 'newpassword456' });

      expect(newLoginRes.status).toBe(200);
    });

    it('PATCH /admin/user/password should return 400 if oldPassword is wrong', async () => {
      const { token } = await registerUser('Password Sbagliata');

      const res = await request(app)
        .patch('/admin/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'wrong', newPassword: 'newpassword456' });

      expect(res.status).toBe(400);

      expect(res.body.error).toBe('La vecchia password non corrisponde');
    });

    it('POST /admin/user/logout should invalidate the token for subsequent requests', async () => {
      const { token } = await registerUser('Logout Test');

      const logoutRes = await request(app)
        .post('/admin/user/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      // Lo stesso identico token, usato subito dopo il logout, deve essere
      // rifiutato: è il comportamento che rende possibile invalidare i
      // vecchi token, descritto in CLAUDE.md.
      const afterLogoutRes = await request(app)
        .get('/admin/user')
        .set('Authorization', `Bearer ${token}`);

      expect(afterLogoutRes.status).toBe(401);

      expect(afterLogoutRes.body.error).toBe('Token non più valido');
    });
  });
});