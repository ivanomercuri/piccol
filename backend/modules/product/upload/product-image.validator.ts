import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { maxHeight, maxWidth } from '../../../config/imageConfig';
import { readImageDimensions } from './image-inspection';

/**
 * Chiave usata per gli errori che riguardano l'insieme delle immagini e non
 * un file preciso ("immagine richiesta", "una sola immagine"). Stessa chiave
 * della validazione legacy, perché compare nel contratto delle risposte.
 */
export const GENERAL_IMAGE_ERROR_KEY = '_generale_';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

/** Un problema su un'immagine: il file a cui si riferisce e il messaggio. */
export interface ImageError {
  filename: string;
  message: string;
}

/**
 * Regole di dominio sulle immagini di un nuovo prodotto.
 *
 * Sostituisce la parte di validazione di validateProductImageMiddleware.ts e
 * checkNumberFilesMiddleware.ts, con gli stessi messaggi. La differenza di
 * struttura è quella annunciata nell'assessment (§4.4): la vecchia catena
 * accumulava gli errori su `req.validationErrors`, un contenitore condiviso
 * scritto da quattro middleware diversi. Qui una sola classe restituisce la
 * propria lista di errori, e nessuno stato attraversa la richiesta.
 *
 * Non cancella i file: di quello si occupa l'interceptor che li ha salvati,
 * per qualunque motivo la richiesta fallisca (ProductImageUploadInterceptor).
 */
@Injectable()
export class ProductImageValidator {
  private readonly maxSizeMb: number;

  constructor(config: ConfigService) {
    this.maxSizeMb = config.getOrThrow<number>('MAX_FILE_SIZE');
  }

  async validate(images: Express.Multer.File[]): Promise<ImageError[]> {
    if (images.length === 0) {
      return [{ filename: GENERAL_IMAGE_ERROR_KEY, message: "L'immagine del prodotto è richiesta" }];
    }

    const errors: ImageError[] = [];

    if (images.length > 1) {
      errors.push({
        filename: GENERAL_IMAGE_ERROR_KEY,
        message: 'Devi caricare una sola immagine del prodotto',
      });
    }

    // Ogni file viene comunque controllato, anche se sono troppi: il client
    // riceve in una sola risposta tutto ciò che va corretto.
    for (const image of images) {
      const problem = await this.problemWith(image);

      if (problem) {
        errors.push({ filename: image.originalname, message: problem });
      }
    }

    return errors;
  }

  /**
   * Il primo problema di un file, o undefined se è valido. I controlli vanno
   * dal più economico al più costoso, così un file già scartato non viene
   * letto dal disco.
   */
  private async problemWith(image: Express.Multer.File): Promise<string | undefined> {
    if (!ALLOWED_MIME_TYPES.includes(image.mimetype)) {
      return `Il file ${image.originalname} non è un'immagine JPG o PNG`;
    }

    if (image.size > megabytesToBytes(this.maxSizeMb)) {
      // Il valore numerico validato, non la variabile d'ambiente grezza: il
      // middleware legacy la interpolava così com'era, e con il valore
      // "3# in MB" il client leggeva "dimensione massima di 3# in MB MB".
      return `Il file supera la dimensione massima di ${this.maxSizeMb} MB`;
    }

    // Lettura asincrona: il middleware legacy usava readFileSync, che blocca
    // l'intero processo (tutte le richieste) per la durata della lettura.
    const dimensions = readImageDimensions(await readFile(image.path));

    // Il Content-Type dichiarava un'immagine, ma i byte non lo sono (o il file
    // è corrotto): vedi image-inspection.ts.
    if (!dimensions) {
      return 'Il file è corrotto o non è un formato di immagine valido';
    }

    if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
      return `Le dimensioni non possono superare ${maxWidth}x${maxHeight}px`;
    }

    return undefined;
  }
}

export function megabytesToBytes(megabytes: number): number {
  return megabytes * 1024 * 1024;
}
