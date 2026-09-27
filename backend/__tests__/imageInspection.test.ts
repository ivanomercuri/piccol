// image-inspection.ts in isolamento: la lettura sicura delle dimensioni,
// cioè la chiusura del debito di sicurezza su image-size aperto in F0.
import { imageSize } from 'image-size';
import {
  hasSupportedImageSignature,
  readImageDimensions,
} from '../modules/product/upload/image-inspection';
import { icnsHeader, jpegHeader, pngHeader, VALID_PNG } from './helpers/imageFixtures';

describe('image-inspection', () => {
  describe('hasSupportedImageSignature', () => {
    // Il controllo guarda i byte reali, non ciò che il client dichiara.
    it('riconosce l\'inizio di un JPEG e di un PNG', () => {
      expect(hasSupportedImageSignature(jpegHeader(10, 10))).toBe(true);

      expect(hasSupportedImageSignature(VALID_PNG)).toBe(true);
    });

    it('rifiuta testo, ICNS e buffer troppo corti', () => {
      expect(hasSupportedImageSignature(Buffer.from('non sono un\'immagine'))).toBe(false);

      expect(hasSupportedImageSignature(icnsHeader())).toBe(false);

      expect(hasSupportedImageSignature(Buffer.from([0x89, 0x50]))).toBe(false);
    });
  });

  describe('readImageDimensions', () => {
    // Le dimensioni vengono dall'intestazione del file: sono quelle che le
    // regole sul prodotto confronteranno con 1920x1080.
    it('legge le dimensioni di un PNG e di un JPEG', () => {
      expect(readImageDimensions(VALID_PNG)).toEqual({ width: 1, height: 1 });

      expect(readImageDimensions(pngHeader(4000, 10))).toEqual({ width: 4000, height: 10 });

      expect(readImageDimensions(jpegHeader(640, 480))).toEqual({ width: 640, height: 480 });
    });

    // Il caso per cui questo modulo esiste: un file di un formato con parser
    // vulnerabile non deve produrre dimensioni, qualunque cosa il client abbia
    // dichiarato. Non si arriva nemmeno a chiamare la libreria.
    it('non legge un file ICNS', () => {
      expect(readImageDimensions(icnsHeader())).toBeUndefined();
    });

    // Firma PNG corretta ma struttura incompleta: è proprio il caso in cui il
    // rilevatore di image-size proverebbe tutti gli altri formati. Deve
    // risultare un file illeggibile, non un'eccezione.
    it('restituisce undefined per un file con firma giusta ma contenuto corrotto', () => {
      const truncated = VALID_PNG.subarray(0, 12);

      expect(readImageDimensions(truncated)).toBeUndefined();
    });
  });

  describe('configurazione di image-size', () => {
    // La seconda difesa, indipendente dalla prima: importando il modulo, i
    // formati diversi da JPG e PNG vengono disattivati nella libreria. Un GIF
    // perfettamente valido, passato DIRETTAMENTE a imageSize (cioè saltando il
    // controllo dei magic bytes), deve essere rifiutato prima del parser.
    it('ha disattivato nella libreria tutti i formati tranne JPG e PNG', () => {
      const gif = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

      expect(() => imageSize(gif)).toThrow(/disabled file type: gif/);
    });
  });
});
