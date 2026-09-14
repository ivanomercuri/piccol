import { disableTypes, imageSize, types } from 'image-size';

/**
 * Lettura sicura delle dimensioni di un'immagine caricata da un utente.
 *
 * IL PROBLEMA (debito aperto in F0, docs/MIGRAZIONE-NESTJS.md §8)
 * `image-size` ha vulnerabilità di denial of service senza correzione
 * disponibile: i parser dei formati ICNS, HEIF e JXL possono entrare in un
 * ciclo infinito su file costruiti apposta, bloccando il processo. Il vecchio
 * middleware chiamava la libreria su qualunque file il cui Content-Type
 * dichiarasse image/png o image/jpeg. Ma quel valore lo sceglie chi carica:
 * un file ICNS dichiarato come PNG arrivava al parser vulnerabile.
 *
 * Verificato nel sorgente della libreria: il rilevatore guarda il primo byte
 * del file; se quel formato non si conferma, prova in ordine TUTTI i 20
 * formati che conosce, compresi quelli vulnerabili.
 *
 * DUE DIFESE, INDIPENDENTI
 * 1. I "magic bytes": prima di chiamare la libreria si controlla che il file
 *    COMINCI davvero come un JPEG o un PNG. Con quei primi byte i validatori
 *    dei formati vulnerabili non possono riconoscerlo (ICNS pretende "icns"
 *    all'inizio, HEIF e JXL una firma a partire dal quarto byte che la firma
 *    PNG occupa con altri valori, e un JPEG viene sempre riconosciuto per
 *    primo come tale).
 * 2. `disableTypes`: si disattivano nella libreria tutti i formati tranne JPG
 *    e PNG. Anche se in futuro un aggiornamento di image-size cambiasse le
 *    regole del rilevatore e la difesa 1 non bastasse più, la libreria
 *    rifiuterebbe il formato PRIMA di eseguirne il parser.
 *
 * La prima difesa da sola dipende dal comportamento attuale di validatori che
 * non controlliamo; la seconda da sola lascerebbe comunque girare il
 * rilevatore su qualunque file. Insieme non dipendono l'una dall'altra.
 */

/** Formati accettati per le immagini dei prodotti, con i nomi usati da image-size. */
const SUPPORTED_FORMATS = ['jpg', 'png'];

// Configurazione GLOBALE della libreria, eseguita una volta al caricamento di
// questo modulo. È stato globale, ed è una scelta consapevole: questo è
// l'unico modulo del progetto che usa image-size, quindi la configurazione
// non può sorprendere nessun altro chiamante; e sta scritta nel punto esatto
// in cui la libreria viene usata, non in un file di avvio lontano.
disableTypes(types.filter((format) => !SUPPORTED_FORMATS.includes(format)));

/** Firma iniziale di ogni file JPEG: FF D8 FF. */
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

/** Firma iniziale di ogni file PNG, definita dallo standard: 8 byte. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Dice se il contenuto comincia come un JPEG o un PNG, guardando i byte
 * reali e non ciò che il client ha dichiarato.
 */
export function hasSupportedImageSignature(content: Buffer): boolean {
  return startsWith(content, JPEG_SIGNATURE) || startsWith(content, PNG_SIGNATURE);
}

/**
 * Restituisce le dimensioni di un JPEG o PNG, oppure undefined se il file non
 * lo è o è corrotto. Non lancia: per chi valida un upload, "non leggibile" è
 * un esito, non un'eccezione.
 */
export function readImageDimensions(content: Buffer): ImageDimensions | undefined {
  if (!hasSupportedImageSignature(content)) {
    return undefined;
  }

  try {
    const { width, height } = imageSize(content);

    return { width, height };
  } catch {
    // Firma giusta ma contenuto non interpretabile: un file troncato o
    // costruito ad arte.
    return undefined;
  }
}

function startsWith(content: Buffer, signature: Buffer): boolean {
  return (
    content.length >= signature.length &&
    content.subarray(0, signature.length).equals(signature)
  );
}
