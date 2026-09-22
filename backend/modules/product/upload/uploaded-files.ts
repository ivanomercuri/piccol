import type { LoggerService } from '@nestjs/common';
import { unlink } from 'fs/promises';

/**
 * Dove finiscono i file caricati, e come li si nomina e li si elimina.
 *
 * Tutto ciò che riguarda la cartella uploads/ sta in questo file: prima di F6
 * la usava solo ProductImageUploadInterceptor, dalla fase F6 anche
 * ProductService, che salva nel database l'indirizzo dell'immagine e cancella
 * il file di una richiesta duplicata. Due punti che conoscono la stessa
 * cartella e la stessa politica di cancellazione devono leggerle da un posto
 * solo (DRY).
 */

/** Cartella dei file caricati, relativa alla cartella di lavoro (backend/). */
export const UPLOADS_DIR = 'uploads/';

/**
 * L'indirizzo con cui l'immagine viene salvata in product_images.image_url:
 * `/uploads/<nome del file>`, lo stesso formato usato dal seed di sviluppo
 * (`/uploads/seed/...`).
 *
 * Il nome è quello casuale scelto da multer, senza estensione: il file resta
 * dove multer l'ha scritto. Spostarlo o rinominarlo dopo il salvataggio del
 * prodotto aprirebbe una finestra in cui il database punta a un file che non
 * esiste (se lo spostamento fallisce dopo il commit), o in cui un file resta
 * orfano (se il commit fallisce dopo lo spostamento). Il tipo reale del file è
 * già stato verificato sui byte da ProductImageValidator.
 *
 * Nota: oggi nessuna rotta serve la cartella uploads/. Servirla è una
 * funzionalità a parte; l'indirizzo è già nella forma che quella rotta userà.
 */
export function publicUrlOf(file: Express.Multer.File): string {
  return `/${UPLOADS_DIR}${file.filename}`;
}

/**
 * Cancella dal disco i file indicati.
 *
 * Un file che non si riesce a cancellare non deve cambiare l'esito della
 * richiesta — né nascondere l'errore che il client deve ricevere, né far
 * fallire una risposta di successo: viene solo segnalato nei log, con il
 * logger di chi chiama. Per questo la funzione non lancia mai.
 */
export async function discardUploadedFiles(
  files: Express.Multer.File[],
  logger: Pick<LoggerService, 'warn'>
): Promise<void> {
  await Promise.all(
    files.map((file) =>
      unlink(file.path).catch((error: unknown) =>
        logger.warn(`File caricato non cancellato: ${file.path} (${String(error)})`)
      )
    )
  );
}
