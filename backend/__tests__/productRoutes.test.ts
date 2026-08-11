// Test end-to-end delle route prodotto. Poiché createProduct è ancora uno
// stub (vedi CLAUDE.md), non possiamo usare POST /products/new per generare
// dati di prova: i prodotti per i test su GET /products vengono creati
// direttamente via modello. POST /products/new viene comunque testata a
// fondo, perché la sua pipeline di validazione (upload, conteggio file,
// dimensioni, campi) è tutta reale e funzionante anche se il controller
// finale non salva nulla.
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../index';
import models from '../models';

const { User, Product, sequelize } = models;

// Un PNG 1x1 valido (pixel trasparente), ben sotto ai limiti di dimensione
// (1920x1080) e peso (MAX_FILE_SIZE) configurati: serve solo a superare la
// validazione, il contenuto dell'immagine non è rilevante per questi test.
const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

const uploadsDir = path.join(__dirname, '..', 'uploads');

describe('Product routes', () => {
  const emailsToClean: string[] = [];
  const productIds: number[] = [];

  /* eslint-disable @typescript-eslint/no-explicit-any */
  let adminA: any;
  let adminB: any;
  let productOfA: any;
  let productOfB: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  async function registerAndLogin(name: string) {
    const email = `product-route-test-${name.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`;

    emailsToClean.push(email);

    const registerRes = await request(app)
      .post('/admin/user/register')
      .send({ name, email, password: 'password123' });

    const user = await User.findOne({ where: { email } });

    return { email, user, token: registerRes.body.data };
  }

  beforeAll(async () => {
    adminA = await registerAndLogin('Admin A');

    adminB = await registerAndLogin('Admin B');

    productOfA = await Product.create({
      name: 'Prodotto di A',
      price: 1,
      createdBy: adminA.user.id,
    });

    productOfB = await Product.create({
      name: 'Prodotto di B',
      price: 2,
      createdBy: adminB.user.id,
    });

    productIds.push(productOfA.id, productOfB.id);
  });

  afterAll(async () => {
    await Product.destroy({ where: { id: productIds } });

    await User.destroy({ where: { email: emailsToClean } });

    await sequelize.close();
  });

  describe('GET /products', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).get('/products');

      expect(res.status).toBe(401);
    });

    it("should return only the requesting admin's own products", async () => {
      const res = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${adminA.token}`);

      expect(res.status).toBe(200);

      const ids = res.body.data.map((p: { id: number }) => p.id);

      expect(ids).toContain(productOfA.id);

      expect(ids).not.toContain(productOfB.id);
    });

    it('should return every product when the user is a superadmin', async () => {
      // Non esiste un endpoint per creare un superadmin: lo eleviamo
      // direttamente sul DB, come si dovrebbe fare anche in produzione
      // (vedi backend/docs/API.md).
      await User.update(
        { level: 'superadmin' },
        { where: { id: adminA.user.id } }
      );

      const res = await request(app)
        .get('/products')
        .set('Authorization', `Bearer ${adminA.token}`);

      expect(res.status).toBe(200);

      const ids = res.body.data.map((p: { id: number }) => p.id);

      expect(ids).toContain(productOfA.id);

      expect(ids).toContain(productOfB.id);

      // Ripristiniamo il livello per non influenzare eventuali altri test
      // in questo stesso file che assumono adminA come admin normale.
      await User.update({ level: 'admin' }, { where: { id: adminA.user.id } });
    });
  });

  describe('POST /products/new', () => {
    it('should return 401 without a token', async () => {
      const res = await request(app).post('/products/new');

      expect(res.status).toBe(401);
    });

    it('should return 400 with a grouped image error when no file and no fields are sent', async () => {
      const res = await request(app)
        .post('/products/new')
        .set('Authorization', `Bearer ${adminA.token}`);

      expect(res.status).toBe(400);

      expect(Array.isArray(res.body.error)).toBe(true);

      const imageError = res.body.error.find(
        (e: { id: string }) => e.id === 'image'
      );

      expect(imageError).toBeDefined();
    });

    it('should return 400 when the uploaded file is not a JPG/PNG', async () => {
      const res = await request(app)
        .post('/products/new')
        .set('Authorization', `Bearer ${adminA.token}`)
        .field('name', 'Prodotto test')
        .field('description', 'Descrizione test')
        .field('price', '9.99')
        .field('quantity', '5')
        .attach('image', Buffer.from('not an image'), {
          filename: 'file.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when more than one image is uploaded (checkNumberFilesMiddleware)', async () => {
      // Verifica in HTTP reale il limite collegato in questa sessione (vedi
      // routes/productRoutes.ts): prima non era collegato a nessuna route.
      const res = await request(app)
        .post('/products/new')
        .set('Authorization', `Bearer ${adminA.token}`)
        .field('name', 'Prodotto test')
        .field('description', 'Descrizione test')
        .field('price', '9.99')
        .field('quantity', '5')
        .attach('image', VALID_PNG, {
          filename: 'one.png',
          contentType: 'image/png',
        })
        .attach('image', VALID_PNG, {
          filename: 'two.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
    });

    it('should let a fully valid request through the whole pipeline (still hits the createProduct stub)', async () => {
      const filesBefore = fs.readdirSync(uploadsDir);

      const res = await request(app)
        .post('/products/new')
        .set('Authorization', `Bearer ${adminA.token}`)
        .field('name', 'Prodotto valido')
        .field('description', 'Descrizione valida')
        .field('price', '9.99')
        .field('quantity', '5')
        .attach('image', VALID_PNG, {
          filename: 'valid.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(200);

      // Fissa deliberatamente il comportamento noto e incompleto: la
      // pipeline di validazione lascia passare la richiesta, ma lo stub
      // createProduct non crea nessuna riga in products. Il giorno in cui
      // verrà implementato, questo test andrà aggiornato di proposito.
      expect(res.body.data).toEqual({});

      // createProduct non ripulisce mai il file caricato in caso di
      // successo (gap noto, vedi backend/docs/API.md): lo ripuliamo qui a
      // mano per non lasciare file orfani in backend/uploads/ ad ogni run.
      const filesAfter = fs.readdirSync(uploadsDir);

      const newFiles = filesAfter.filter((f) => !filesBefore.includes(f));

      newFiles.forEach((f) => fs.unlinkSync(path.join(uploadsDir, f)));
    });
  });
});