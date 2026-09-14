// Test end-to-end delle route prodotto. Poiché createProduct è ancora uno
// stub (vedi CLAUDE.md), non possiamo usare POST /products/new per generare
// dati di prova: i prodotti per i test su GET /products vengono creati
// direttamente via modello.
//
// Dalla fase F4 il dominio è servito da NestJS. Le asserzioni che c'erano già
// sono rimaste, con un'unica modifica voluta: `data` di GET /products è ora
// una pagina (`data.items`). Le sezioni "F4" in fondo fissano paginazione,
// limiti di upload, casi di sicurezza e comportamenti cambiati. POST /products/new viene comunque testata a
// fondo, perché la sua pipeline di validazione (upload, conteggio file,
// dimensioni, campi) è tutta reale e funzionante anche se il controller
// finale non salva nulla.
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { useTestApp } from './helpers/useTestApp';
import { prisma } from '../prisma/client';

// Immagini di prova costruite byte per byte (vedi helpers/imageFixtures.ts).
// VALID_PNG è un PNG 1x1 reale, ben sotto ogni limite.
import { icnsHeader, pngHeader, pngOfSize, VALID_PNG } from './helpers/imageFixtures';

const uploadsDir = path.join(__dirname, '..', 'uploads');

// Avvio e chiusura dell'app NestJS, gestiti dall'helper. Chiamato qui, alla
// radice del file e fuori dal describe, perché la chiusura (che disconnette
// Prisma) avvenga sempre DOPO gli afterAll di pulizia del describe: vedi il
// commento in helpers/useTestApp.ts.
const testApp = useTestApp();

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
    // .toLowerCase() necessario: l'email deriva da `name` ("Admin A"), quindi
    // conterrebbe maiuscole, mentre la registrazione salva sempre la forma
    // normalizzata (vedi services/emailNormalizer.ts). Su MySQL la ricerca
    // qui sotto funzionava comunque, per via della collation
    // case-insensitive di default; su PostgreSQL, che confronta in modo
    // case-sensitive, findOne non troverebbe la riga e `user` resterebbe
    // null — difetto latente del test emerso solo con la migrazione del
    // database.
    const email = `product-route-test-${name.replace(/\s+/g, '-')}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@example.com`.toLowerCase();

    emailsToClean.push(email);

    const registerRes = await request(testApp.http)
      .post('/admin/user/register')
      .send({ name, email, password: 'password123' });

    const user = await prisma.user.findUnique({ where: { email } });

    return { email, user, token: registerRes.body.data };
  }

  beforeAll(async () => {
    adminA = await registerAndLogin('Admin A');

    adminB = await registerAndLogin('Admin B');

    productOfA = await prisma.product.create({
      data: {
        name: 'Prodotto di A',
        price: 1,
        createdBy: adminA.user.id,
      },
    });

    productOfB = await prisma.product.create({
      data: {
        name: 'Prodotto di B',
        price: 2,
        createdBy: adminB.user.id,
      },
    });

    productIds.push(productOfA.id, productOfB.id);
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });

    await prisma.user.deleteMany({ where: { email: { in: emailsToClean } } });
  });

  describe('GET /products', () => {
    it('should return 401 without a token', async () => {
      const res = await request(testApp.http).get('/products');

      expect(res.status).toBe(401);
    });

    it("should return only the requesting admin's own products", async () => {
      const res = await request(testApp.http)
        .get('/products')
        .set('Authorization', `Bearer ${adminA.token}`);

      expect(res.status).toBe(200);

      // Dalla fase F4 la risposta è paginata: i prodotti sono in data.items.
      const ids = res.body.data.items.map((p: { id: number }) => p.id);

      expect(ids).toContain(productOfA.id);

      expect(ids).not.toContain(productOfB.id);
    });

    it('should return every product when the user is a superadmin', async () => {
      // Non esiste un endpoint per creare un superadmin: lo eleviamo
      // direttamente sul DB, come si dovrebbe fare anche in produzione
      // (vedi backend/docs/API.md).
      await prisma.user.update({
        where: { id: adminA.user.id },
        data: { level: 'superadmin' },
      });

      const res = await request(testApp.http)
        .get('/products')
        .set('Authorization', `Bearer ${adminA.token}`);

      expect(res.status).toBe(200);

      // Dalla fase F4 la risposta è paginata: i prodotti sono in data.items.
      const ids = res.body.data.items.map((p: { id: number }) => p.id);

      expect(ids).toContain(productOfA.id);

      expect(ids).toContain(productOfB.id);

      // Ripristiniamo il livello per non influenzare eventuali altri test
      // in questo stesso file che assumono adminA come admin normale.
      await prisma.user.update({
        where: { id: adminA.user.id },
        data: { level: 'admin' },
      });
    });
  });

  describe('POST /products/new', () => {
    it('should return 401 without a token', async () => {
      const res = await request(testApp.http).post('/products/new');

      expect(res.status).toBe(401);
    });

    it('should return 400 with a grouped image error when no file and no fields are sent', async () => {
      const res = await request(testApp.http)
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
      const res = await request(testApp.http)
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
      const res = await request(testApp.http)
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

      const res = await request(testApp.http)
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
  // Nomi dei file presenti ora in backend/uploads/: serve a verificare che
  // una richiesta fallita non lasci file temporanei dietro di sé.
  function uploadedFileNames(): string[] {
    return fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
  }

  // Invia un form di nuovo prodotto con campi validi e l'immagine indicata.
  function postProductWith(image: Buffer, filename = 'immagine.png', contentType = 'image/png') {
    return request(testApp.http)
      .post('/products/new')
      .set('Authorization', `Bearer ${adminA.token}`)
      .field('name', 'Prodotto test')
      .field('description', 'Descrizione test')
      .field('price', '9.99')
      .field('quantity', '5')
      .attach('image', image, { filename, contentType });
  }

  // Il messaggio d'errore per il file indicato, nella forma raggruppata.
  function imageErrorFor(body: { error: unknown }, filename: string): string | undefined {
    const errors = body.error as Array<{ id: string; message: Array<{ filename: string; message: string }> }>;

    return errors.find((e) => e.id === 'image')?.message.find((m) => m.filename === filename)?.message;
  }

  describe('F4: paginazione di GET /products', () => {
    // Tre prodotti di adminB con data di creazione esplicita, per conoscere
    // l'ordine atteso (dal più recente) senza dipendere dall'orologio.
    let paged: Array<{ id: number }>;

    beforeAll(async () => {
      const base = Date.now();

      paged = [];

      for (const offset of [1, 2, 3]) {
        const product = await prisma.product.create({
          data: {
            name: `Paginato ${offset}`,
            price: 1,
            createdBy: adminB.user.id,
            createdAt: new Date(base + offset * 1000),
          },
        });

        productIds.push(product.id);

        paged.push(product);
      }
    });

    // Senza parametri: prima pagina, 20 elementi, e i metadati per chiedere
    // le altre. adminB vede solo i propri 4 prodotti (quello del beforeAll
    // generale più i 3 di questa sezione).
    it('senza parametri restituisce la prima pagina da 20 con i metadati', async () => {
      const res = await request(testApp.http)
        .get('/products')
        .set('Authorization', `Bearer ${adminB.token}`);

      expect(res.status).toBe(200);

      expect(res.body.data).toEqual(
        expect.objectContaining({ page: 1, limit: 20, total: 4, totalPages: 1 })
      );
    });

    // Due pagine da 2: nessun prodotto ripetuto, nessuno perso, e l'ordine è
    // dal più recente. È ciò che l'ordinamento stabile deve garantire.
    it('divide i prodotti in pagine senza ripetizioni, dal più recente', async () => {
      const auth = { Authorization: `Bearer ${adminB.token}` };

      const first = await request(testApp.http).get('/products?page=1&limit=2').set(auth);

      const second = await request(testApp.http).get('/products?page=2&limit=2').set(auth);

      const ids = [...first.body.data.items, ...second.body.data.items].map(
        (p: { id: number }) => p.id
      );

      expect(first.body.data.totalPages).toBe(2);

      expect(new Set(ids).size).toBe(4);

      expect(ids.slice(0, 3)).toEqual([paged[2].id, paged[1].id, paged[0].id]);
    });

    // Un client non può chiedere la tabella intera, né pagine insensate.
    it('rifiuta limit oltre 100 e page minore di 1', async () => {
      const auth = { Authorization: `Bearer ${adminB.token}` };

      const tooMany = await request(testApp.http).get('/products?limit=101').set(auth);

      const pageZero = await request(testApp.http).get('/products?page=0').set(auth);

      expect(tooMany.status).toBe(400);

      expect(tooMany.body.error).toEqual([{ id: 'limit', message: 'limit non può superare 100' }]);

      expect(pageZero.status).toBe(400);

      expect(pageZero.body.error).toEqual([{ id: 'page', message: 'page deve essere almeno 1' }]);
    });
  });

  describe('F4: upload e validazione di POST /products/new', () => {
    // Campi e immagine vengono segnalati INSIEME, in una risposta: prima i
    // campi, poi l'immagine, come nel legacy (decisione D2).
    it('segnala insieme errori dei campi ed errore dell\'immagine', async () => {
      const res = await request(testApp.http)
        .post('/products/new')
        .set('Authorization', `Bearer ${adminA.token}`)
        .field('name', 'Solo il nome')
        .field('price', 'gratis');

      expect(res.status).toBe(400);

      expect(res.body.error.map((e: { id: string }) => e.id)).toEqual([
        'description',
        'price',
        'quantity',
        'image',
      ]);
    });

    // Bug corretto: il legacy cancellava i file temporanei solo per errori
    // sull'immagine. Con un'immagine valida e un campo mancante, il file
    // restava in uploads/ per sempre.
    it('non lascia file temporanei quando falliscono solo i campi', async () => {
      const before = uploadedFileNames();

      const res = await request(testApp.http)
        .post('/products/new')
        .set('Authorization', `Bearer ${adminA.token}`)
        .field('name', 'Senza gli altri campi')
        .attach('image', VALID_PNG, { filename: 'valida.png', contentType: 'image/png' });

      expect(res.status).toBe(400);

      expect(uploadedFileNames()).toEqual(before);
    });

    // Bug corretto: il messaggio interpolava MAX_FILE_SIZE grezza, e con il
    // valore "3# in MB" il client leggeva "dimensione massima di 3# in MB MB".
    it('rifiuta un file oltre MAX_FILE_SIZE con un messaggio pulito', async () => {
      const limit = Number(process.env.MAX_FILE_SIZE);

      const res = await postProductWith(pngOfSize(limit + 1), 'pesante.png');

      expect(res.status).toBe(400);

      expect(imageErrorFor(res.body, 'pesante.png')).toBe(
        `Il file supera la dimensione massima di ${limit} MB`
      );
    });

    // Oltre il limite hard l'upload viene interrotto da multer mentre arriva:
    // 413 (prima 400) con il messaggio volutamente vago del legacy, e nessun
    // file lasciato su disco. Il limite ora è davvero MAX_FILE_HARD_SIZE, non
    // più il 10 scritto a mano.
    it('interrompe con 413 un file oltre MAX_FILE_HARD_SIZE, senza lasciare file', async () => {
      const before = uploadedFileNames();

      const res = await postProductWith(pngOfSize(Number(process.env.MAX_FILE_HARD_SIZE) + 1));

      expect(res.status).toBe(413);

      expect(res.body.error).toBe('Operazione non permessa.');

      expect(uploadedFileNames()).toEqual(before);
    });

    it('rifiuta un\'immagine più grande di 1920x1080', async () => {
      const res = await postProductWith(pngHeader(3000, 2000), 'enorme.png');

      expect(imageErrorFor(res.body, 'enorme.png')).toBe(
        'Le dimensioni non possono superare 1920x1080px'
      );
    });

    // Sicurezza (debito aperto in F0): un file ICNS dichiarato come PNG non
    // deve raggiungere il parser vulnerabile di image-size. Viene rifiutato
    // come file non valido, e la richiesta risponde normalmente.
    it('rifiuta un file ICNS travestito da PNG', async () => {
      const res = await postProductWith(icnsHeader(), 'icona.png');

      expect(res.status).toBe(400);

      expect(imageErrorFor(res.body, 'icona.png')).toBe(
        'Il file è corrotto o non è un formato di immagine valido'
      );
    });

    // Un campo file con un nome diverso da `image` è un errore del client.
    it('rifiuta un file inviato in un campo diverso da `image`', async () => {
      const res = await request(testApp.http)
        .post('/products/new')
        .set('Authorization', `Bearer ${adminA.token}`)
        .attach('foto', VALID_PNG, { filename: 'foto.png', contentType: 'image/png' });

      expect(res.status).toBe(400);

      expect(res.body.error).toBe("Richiesta di caricamento dell'immagine non valida");
    });
  });
});