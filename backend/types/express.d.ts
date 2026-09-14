// Estensioni ambient di Express. Dalla fase F4 della migrazione a NestJS
// restano due cose: il tipo dell'utente autenticato (req.user) e i metodi
// res.success/res.error, usati solo dall'ultimo router legacy (/routes) fino
// a F5. `req.validationErrors`, l'accumulatore degli errori di upload, è
// sparito con la catena di middleware che lo scriveva.
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
      // Aggiunti da middlewares/responseFormatter.ts (monkey-patch su ogni
      // risposta, montato da app.setup.ts). Firma presa 1:1 da quel file — se
      // cambia lì, va aggiornata anche qui. `message` è `unknown`: res.error
      // lo serializza così com'è, senza assumerne la forma. Spariscono in F5
      // insieme all'ultimo router legacy che li usa.
      success(data: unknown, message?: string, code?: number): void;
      error(code?: number, message?: unknown, err?: Error | null): void;
    }
  }
}

export {};