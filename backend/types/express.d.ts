// Estensioni ambient di Express, usate da tutti i controller/middleware man
// mano che vengono convertiti a TypeScript (Fase 2.5+). Due cose vengono
// aggiunte a runtime da middleware ancora .js, non presenti nei tipi
// pubblici di @types/express: qui le dichiariamo una sola volta invece di
// ripetere cast in ogni file.
import 'express';

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

      // Valorizzato da middlewares/authUserMiddleware.js con l'istanza
      // Sequelize reale dell'utente autenticato (User.findOne(...)).
      // Interfaccia "duck-typed" minima con solo i campi che i controller
      // convertiti finora leggono/scrivono — non l'intera classe User
      // (models/user.ts) per non dover riaprire la Fase 2.3 già chiusa solo
      // per esportarne il tipo (stessa scelta già fatta in services/ per
      // AuthUserInstance).
      user?: {
        id: number;
        name: string;
        email: string;
        level: 'admin' | 'superadmin';
        password: string;
        current_token: string | null;
        save: () => Promise<unknown>;
      };
    }
  }
}

export {};