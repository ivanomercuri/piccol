import type { LoggerService } from '@nestjs/common';
import { rename, unlink } from 'fs/promises';
import path from 'path';

/**
 * Dove finiscono le immagini caricate, come si nominano e come si eliminano.
 *
 * Tutto ciò che riguarda il disco sta in questo file: lo usano
 * ProductImageUploadInterceptor (riceve i file e li cancella in caso di errore)
 * e ProductService (sposta il file al suo posto definitivo e cancella quello di
 * una richiesta duplicata). Due punti che conoscono la stessa cartella e la
 * stessa politica di cancellazione devono leggerle da un posto solo (DRY).
 */

/** Cartella delle immagini definitive, relativa alla cartella di lavoro (backend/). */
export const UPLOADS_DIR = 'uploads/';

/**
 * Cartella dei file appena ricevuti, prima della validazione.
 *
 * PERCHÉ UNA CARTELLA SEPARATA (dalla fase F7)
 * @fastify/multipart registra un hook che, a ogni risposta, cancella i file
 * che ha scritto (verificato nel sorgente del plugin). Un file che deve
 * sopravvivere alla richiesta va quindi spostato altrove prima di rispondere:
 * qui dentro ci sono solo file in transito, in uploads/ solo quelli
 * referenziati da un prodotto. È anche più leggibile di due tipi di file
 * mescolati nella stessa cartella.
 *
 * Sta sotto uploads/ di proposito: lo spostamento è così un rename nella stessa
 * partizione, operazione atomica e istantanea, invece di una copia.
 */
export const TEMP_UPLOADS_DIR = path.join(UPLOADS_DIR, 'tmp/');

/** Estensione del file definitivo, decisa dal tipo REALE dell'immagine. */
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/**
 * Un'immagine ricevuta e salvata su disco, nei soli termini che servono al
 * progetto: il nome dichiarato dal client (per i messaggi d'errore), il tipo,
 * il peso e dove si trova adesso.
 *
 * Fino alla fase F6 questo tipo era `Express.Multer.File`, con una ventina di
 * proprietà di cui il progetto usava quattro. Un tipo proprio ha due vantaggi:
 * non lega validatore e service alla libreria di upload (con Fastify è
 * cambiata), e rende ovvio, leggendo la firma, cosa serve davvero.
 */
export interface UploadedImage {
  /** Nome del file come lo ha dichiarato il client: solo per i messaggi. */
  originalname: string;
  mimetype: string;
  size: number;
  /** Percorso attuale su disco. Cambia quando l'immagine viene archiviata. */
  path: string;
}

/** Un'immagine archiviata: dov'è il file e con quale indirizzo si raggiunge. */
export interface StoredImage {
  path: string;
  url: string;
}

/**
 * Sposta un'immagine già validata dalla cartella temporanea a quella
 * definitiva, e restituisce l'indirizzo con cui il database la referenzia.
 *
 * QUANDO CHIAMARLA: dopo la validazione e PRIMA di scrivere nel database. Se la
 * scrittura fallisce, chi ha chiamato cancella il file (il percorso è nel
 * valore restituito); se invece si spostasse il file DOPO il commit, un
 * fallimento dello spostamento lascerebbe una riga che punta a un file
 * inesistente — cioè un guasto non rimediabile automaticamente, mentre un file
 * orfano lo è.
 *
 * L'estensione viene dal tipo verificato sui byte, non dal nome scelto dal
 * client: un file chiamato "foto.php" con dentro un PNG diventa "<id>.png".
 * Serve a un'eventuale rotta che serva queste immagini, che dedurrebbe il tipo
 * dall'estensione.
 */
export async function storeUploadedImage(image: UploadedImage): Promise<StoredImage> {
  const extension = EXTENSION_BY_MIME_TYPE[image.mimetype] ?? '';

  // Il nome casuale lo ha già scelto il plugin di upload, insieme
  // all'estensione del file originale: si tiene la parte casuale e si rifà
  // l'estensione.
  const name = path.basename(image.path, path.extname(image.path)) + extension;

  const finalPath = path.join(UPLOADS_DIR, name);

  await rename(image.path, finalPath);

  return { path: finalPath, url: `/${UPLOADS_DIR}${name}` };
}

/**
 * Cancella dal disco i file indicati.
 *
 * Non lancia mai: un file che non si riesce a cancellare non deve cambiare
 * l'esito della richiesta, né nascondere l'errore che il client deve ricevere,
 * né far fallire una risposta di successo. Viene solo segnalato nei log, con il
 * logger di chi chiama.
 *
 * Un file già assente non è un problema da segnalare (ENOENT): accade
 * normalmente, ad esempio quando il file è già stato spostato o quando il
 * plugin di upload lo ha rimosso per primo.
 */
export async function discardUploadedFiles(
  paths: string[],
  logger: Pick<LoggerService, 'warn'>
): Promise<void> {
  await Promise.all(
    paths.map((filePath) =>
      unlink(filePath).catch((error: unknown) => {
        if ((error as { code?: string }).code === 'ENOENT') {
          return;
        }

        logger.warn(`File caricato non cancellato: ${filePath} (${String(error)})`);
      })
    )
  );
}
