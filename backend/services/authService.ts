import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';
import { signToken } from './tokenService';
import { normalizeEmail } from './emailNormalizer';

/**
 * Esito di un tentativo di autenticazione.
 *
 * È una "unione discriminata": due forme possibili, distinte dal valore del
 * campo `success`. Prima era un solo tipo con `message?` e `token?` entrambi
 * opzionali, che permetteva stati privi di senso (success true senza token,
 * oppure con un messaggio d'errore) e obbligava chi lo usava a controllare
 * campi che in quel ramo non potevano mancare. Con l'unione, dopo
 * `if (result.success)` TypeScript SA che `token` è una stringa; nel ramo
 * opposto sa che c'è `message`. Nessun controllo superfluo, nessun cast.
 *
 * Non c'è un equivalente diretto in PHP, dove si otterrebbe con due classi
 * distinte e un instanceof.
 */
export type AuthResult =
  | { success: true; token: string }
  | { success: false; message: string };

// Forma minima che serve alla logica condivisa qui sotto: sia User sia
// Customer la soddisfano. Non è un "contratto" da verificare a runtime come
// il vecchio authContract.ts — con Prisma i due delegate sono già tipizzati
// con precisione, quindi è TypeScript a garantire che ciò che passiamo abbia
// questi campi, senza controlli né cast.
interface AuthenticatableEntity {
  id: number;
  email: string;
  password: string;
}

/**
 * Cuore condiviso dell'autenticazione: confronto della password, firma del
 * token e sua persistenza. Riceve l'entità GIÀ recuperata dal database e una
 * funzione che sa come salvarle il token, così l'unica cosa che cambia fra
 * User e Customer resta la query — la logica di sicurezza vive in un punto
 * solo.
 *
 * ESPORTATA DALLA FASE F2 della migrazione a NestJS: il login dei Customer
 * vive ora in modules/customer/customer-auth.service.ts, quello degli User è
 * ancora qui sotto. Esportare questa funzione permette a entrambi di usarla
 * invece di duplicarla (vietato da CLAUDE.md). Quando anche User migrerà, in
 * F3, diventerà un provider iniettabile: oggi dipende da signToken, che legge
 * JWT_SECRET da process.env, e non ha ancora senso iniettarla in un solo
 * chiamante NestJS.
 *
 * Prima questa condivisione era ottenuta con una funzione generica sul
 * modello Sequelize (`ModelStatic<Model<TAttrs>>` più un controllo runtime
 * dei campi): quell'apparato non ha equivalente in Prisma, dove i delegate
 * non sono classi con metodi statici e non espongono i propri campi. La
 * condivisione è quindi passata dal "modello generico" all'"entità già
 * letta", che è ciò che alla logica serviva davvero.
 */
export async function completeAuthentication(
  entity: AuthenticatableEntity,
  plainPassword: string,
  persistToken: (token: string) => Promise<unknown>
): Promise<AuthResult> {
  const passwordMatch = await bcrypt.compare(plainPassword, entity.password);

  if (!passwordMatch) {
    return { success: false, message: 'Password errata' };
  }

  const token = signToken({ id: entity.id, email: entity.email });

  // Il token firmato viene salvato anche sull'entità: è ciò che rende
  // possibile invalidare i vecchi JWT al logout o al cambio password (vedi
  // il pattern di invalidazione in CLAUDE.md).
  await persistToken(token);

  return { success: true, token };
}

/**
 * Login di un utente interno/admin.
 *
 * La ricerca usa l'email normalizzata perché è in quella forma che viene
 * salvata: su PostgreSQL, che confronta le stringhe in modo case-sensitive,
 * cercare "Mario@x.com" non troverebbe la riga salvata come "mario@x.com".
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });

  if (!user) {
    return { success: false, message: 'Utente non trovato' };
  }

  return completeAuthentication(user, password, (token) =>
    prisma.user.update({
      where: { id: user.id },
      data: { current_token: token },
    })
  );
}
