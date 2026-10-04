import dotenv from 'dotenv';
import path from 'path';

/**
 * Carica il file `.env` della radice del repo dentro `process.env`.
 *
 * SERVE SOLO A CHI GIRA FUORI DAL CONTAINER DI NESTJS
 * L'applicazione non la chiama: dalla fase F8 è `ConfigModule` a leggere il
 * file, a validarlo e a esporlo con `ConfigService`. Qui restano i programmi
 * che un ConfigModule non ce l'hanno: `prisma.config.ts` (eseguito dalla CLI
 * di Prisma per migrate, db push e generate) e `prisma/client.ts`, che serve
 * ai seed e ai test dei modelli.
 *
 * IL PERCORSO PARTE DALLA CARTELLA DI LAVORO, non da `__dirname`: questi
 * programmi girano sia come TypeScript interpretato (`ts-node`, ts-jest) sia
 * compilati in `dist/`, e in quei due casi `__dirname` sta a profondità
 * diverse. I comandi del progetto si lanciano sempre da `backend/` (vedi
 * CLAUDE.md), quindi la radice del repo è sempre un livello sopra.
 *
 * Dentro Docker il file non è montato e non viene trovato: nessuna
 * conseguenza, le variabili arrivano già da `env_file`. E dotenv non
 * sovrascrive mai quelle presenti.
 */
export function loadEnvFile(): void {
  dotenv.config({ path: path.resolve(process.cwd(), '..', '.env') });
}
