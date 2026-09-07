// Estensioni ambient di Express, usate da tutti i controller/middleware man
// mano che vengono convertiti a TypeScript (Fase 2.5+). Due cose vengono
// aggiunte a runtime da middleware ancora .js, non presenti nei tipi
// pubblici di @types/express: qui le dichiariamo una sola volta invece di
// ripetere cast in ogni file.
import 'express';
import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Response {
      // Aggiunti da middlewares/responseFormatter.js (monkey-patch su ogni
      // risposta, primo middleware della catena in index.js). Firma presa
      // 1:1 da quel file — se cambia lì, va aggiornata anche qui. `message`
      // è `unknown`, non `string`: validationHandlerMiddleware.js ci passa
      // un array di errori raggruppati (res.error(400, finalErrors)), non
      // solo stringhe — res.error lo serializza così com'è nel JSON di
      // risposta, senza mai assumerne la forma.
      success(data: unknown, message?: string, code?: number): void;
      error(code?: number, message?: unknown, err?: Error | null): void;
    }

    interface Request {
      // Accumulo errori di validazione file-upload (vedi CLAUDE.md → "Pattern
      // di accumulo degli errori di validazione"): attraversa uploadMiddleware,
      // handleMulterErrorsMiddleware, validateProductImageMiddleware,
      // checkNumberFilesMiddleware, prima di essere unito agli errori di
      // express-validator in validationHandlerMiddleware.
      validationErrors?: Array<{
        msg: string;
        path?: string;
        filename?: string;
        isFatal?: boolean;
      }>;

      // Valorizzato da middlewares/authUserMiddleware.ts con la riga
      // dell'utente autenticato letta via Prisma.
      //
      // Ora è direttamente il tipo `User` generato da Prisma dallo schema,
      // non più un'interfaccia "duck-typed" scritta a mano: con Sequelize
      // esportare il tipo del modello avrebbe richiesto di riaprire scelte
      // già chiuse, mentre il client generato lo espone gratis e resta
      // allineato allo schema da solo. Nota che NON ha più `save()`: le
      // istanze Prisma sono oggetti semplici, l'aggiornamento passa da
      // prisma.user.update().
      user?: User;
    }
  }
}

export {};