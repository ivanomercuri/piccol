// Estensioni ambient di Express, usate da tutti i controller/middleware man
// mano che vengono convertiti a TypeScript (Fase 2.5+). Due cose vengono
// aggiunte a runtime da middleware ancora .js, non presenti nei tipi
// pubblici di @types/express: qui le dichiariamo una sola volta invece di
// ripetere cast in ogni file.
import 'express';
import type { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    // L'utente autenticato, in `req.user`.
    //
    // PERCHÉ UN'INTERFACCIA CHE ESTENDE QUELLA DI PRISMA, e non più
    // `user?: User` dentro Request come fino alla fase F2.
    // Dalla fase F3 il progetto usa passport, i cui tipi (@types/passport)
    // dichiarano già `Request.user?: Express.User`, con Express.User vuota,
    // pensata per essere estesa da ogni applicazione. Due effetti, entrambi
    // verificati con il type-check:
    // - una seconda dichiarazione di `user` in Request entrerebbe in conflitto
    //   con quella di passport;
    // - dentro `namespace Express`, il nome `User` indica Express.User e non
    //   più il tipo importato da Prisma: il vecchio `user?: User` si era
    //   ritrovato, senza cambiare una riga, a indicare un'interfaccia vuota, e
    //   productController non poteva più leggere `level` e `id`.
    // Estendere Express.User con la riga di Prisma è il modo previsto da
    // passport: `req.user` è l'utente del database sia per il middleware
    // legacy dei prodotti sia per JwtUserStrategy.
    //
    // L'import è rinominato PrismaUser proprio per non ricreare l'ambiguità.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends PrismaUser {}

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

    }
  }
}

export {};