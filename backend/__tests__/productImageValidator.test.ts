// ProductImageValidator in isolamento, con file veri scritti in una cartella
// temporanea: il validatore li legge dal disco come fa con quelli di multer.
// Eredita i casi di validateProductImageMiddleware.test.ts e
// checkNumberFilesMiddleware.test.ts, rimossi in F4.
import type { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { ProductImageValidator } from '../modules/product/upload/product-image.validator';
import { icnsHeader, pngHeader, VALID_PNG } from './helpers/imageFixtures';

describe('ProductImageValidator', () => {
  // Limite di business di 3 MB, come in .env.
  const config = { getOrThrow: () => 3 } as unknown as ConfigService;

  const validator = new ProductImageValidator(config);

  let directory: string;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'product-image-validator-'));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  // Scrive il contenuto su disco e restituisce un oggetto con la forma che
  // multer produce per un file ricevuto. `size` è quella dichiarata da multer,
  // quindi si può simulare un file pesante senza scriverlo davvero.
  async function uploaded(
    name: string,
    content: Buffer,
    overrides: Partial<Express.Multer.File> = {}
  ): Promise<Express.Multer.File> {
    const filePath = path.join(directory, name);

    await writeFile(filePath, content);

    return {
      originalname: name,
      mimetype: 'image/png',
      size: content.length,
      path: filePath,
      fieldname: 'image',
      ...overrides,
    } as Express.Multer.File;
  }

  // Caso base: un PNG piccolo e reale non ha problemi.
  it('accetta una sola immagine valida', async () => {
    await expect(validator.validate([await uploaded('ok.png', VALID_PNG)])).resolves.toEqual([]);
  });

  it('richiede un\'immagine', async () => {
    await expect(validator.validate([])).resolves.toEqual([
      { filename: '_generale_', message: "L'immagine del prodotto è richiesta" },
    ]);
  });

  // Troppi file: l'errore generale, e comunque il controllo di ogni file,
  // così il client riceve tutto in una risposta.
  it('segnala più di un\'immagine e controlla comunque ogni file', async () => {
    const errors = await validator.validate([
      await uploaded('uno.png', VALID_PNG),
      await uploaded('due.png', pngHeader(5000, 5000)),
    ]);

    expect(errors).toEqual([
      { filename: '_generale_', message: 'Devi caricare una sola immagine del prodotto' },
      { filename: 'due.png', message: 'Le dimensioni non possono superare 1920x1080px' },
    ]);
  });

  // Il tipo dichiarato non è un'immagine ammessa.
  it('rifiuta un tipo dichiarato diverso da JPG e PNG', async () => {
    const errors = await validator.validate([
      await uploaded('doc.txt', Buffer.from('testo'), { mimetype: 'text/plain' }),
    ]);

    expect(errors).toEqual([
      { filename: 'doc.txt', message: "Il file doc.txt non è un'immagine JPG o PNG" },
    ]);
  });

  // Oltre il limite di business. Il messaggio usa il numero validato: il
  // legacy interpolava la variabile grezza, e con "3# in MB" scriveva
  // "dimensione massima di 3# in MB MB".
  it('rifiuta un file oltre MAX_FILE_SIZE con un messaggio pulito', async () => {
    const errors = await validator.validate([
      await uploaded('grande.png', VALID_PNG, { size: 4 * 1024 * 1024 }),
    ]);

    expect(errors).toEqual([
      { filename: 'grande.png', message: 'Il file supera la dimensione massima di 3 MB' },
    ]);
  });

  // Un file che si dichiara PNG ma non lo è: il Content-Type lo sceglie chi
  // carica, i byte no.
  it('rifiuta un file dichiarato PNG che non lo è', async () => {
    const errors = await validator.validate([
      await uploaded('finto.png', Buffer.from('non sono un png')),
    ]);

    expect(errors).toEqual([
      { filename: 'finto.png', message: 'Il file è corrotto o non è un formato di immagine valido' },
    ]);
  });

  // Il caso di sicurezza: un ICNS (formato con parser vulnerabile in
  // image-size) travestito da PNG viene rifiutato come file non valido.
  it('rifiuta un file ICNS travestito da PNG', async () => {
    const errors = await validator.validate([await uploaded('icona.png', icnsHeader())]);

    expect(errors[0].message).toBe('Il file è corrotto o non è un formato di immagine valido');
  });

  it('rifiuta un\'immagine più grande di 1920x1080', async () => {
    const errors = await validator.validate([await uploaded('enorme.png', pngHeader(1921, 100))]);

    expect(errors).toEqual([
      { filename: 'enorme.png', message: 'Le dimensioni non possono superare 1920x1080px' },
    ]);
  });
});
