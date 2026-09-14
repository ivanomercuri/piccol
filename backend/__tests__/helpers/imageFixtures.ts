/**
 * Immagini di prova costruite byte per byte.
 *
 * Per verificare le regole sulle dimensioni non servono immagini vere e
 * pesanti: image-size legge solo l'intestazione. Bastano poche decine di byte
 * con la struttura giusta per dichiarare, ad esempio, un PNG 4000x10.
 */

/** Un PNG 1x1 valido e completo (pixel trasparente), entro ogni limite. */
export const VALID_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

/**
 * Intestazione PNG con le dimensioni indicate: firma di 8 byte, poi il chunk
 * IHDR, dove lo standard mette larghezza e altezza in 4 byte ciascuna.
 */
export function pngHeader(width: number, height: number): Buffer {
  const header = Buffer.alloc(33);

  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);

  header.writeUInt32BE(13, 8); // lunghezza del chunk IHDR

  header.write('IHDR', 12, 'ascii');

  header.writeUInt32BE(width, 16);

  header.writeUInt32BE(height, 20);

  return header;
}

/**
 * Intestazione JPEG con le dimensioni indicate: marcatore di inizio (FF D8),
 * un segmento APP0 di 16 byte, poi il segmento SOF0 (FF C0), che contiene
 * altezza e larghezza.
 */
export function jpegHeader(width: number, height: number): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    Buffer.alloc(14),
    Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03]),
    Buffer.alloc(9),
  ]);
}

/**
 * Inizio di un file ICNS (icone macOS): uno dei formati il cui parser in
 * image-size ha una vulnerabilità di denial of service. Usato per verificare
 * che un file del genere, dichiarato come PNG, non arrivi mai al parser.
 */
export function icnsHeader(): Buffer {
  const header = Buffer.alloc(16);

  header.write('icns', 0, 'ascii');

  header.writeUInt32BE(16, 4);

  return header;
}

/** Un buffer di `megabytes` MB che comincia con la firma PNG. */
export function pngOfSize(megabytes: number): Buffer {
  const content = Buffer.alloc(megabytes * 1024 * 1024);

  VALID_PNG.copy(content, 0);

  return content;
}
