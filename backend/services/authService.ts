import bcrypt from 'bcryptjs';
import { Model, ModelStatic } from 'sequelize';
import { signToken } from './tokenService';
import { assertAuthCompatible, AuthCompatibleAttributes } from './authContract';

interface AuthResult {
  success: boolean;
  message?: string;
  token?: string;
}

// Rappresenta l'istanza restituita da findOne() come oggetto con proprietà
// dot-accessibili dirette (user.password, user.email, ...) invece che via
// getDataValue(): è così che il codice ha sempre funzionato a runtime (le
// istanze Sequelize reali espongono i campi dichiarati come proprietà
// normali) ed è la forma che authService.test.js si aspetta dai suoi mock
// (oggetti letterali, non vere istanze Sequelize — niente getDataValue()).
// `id` non fa parte del contratto AuthCompatibleAttributes (non è mai stato
// verificato nemmeno dal vecchio controllo runtime): resta un'assunzione
// implicita pre-esistente, mai stata resa esplicita — segnalata, non
// corretta qui.
type AuthUserInstance = AuthCompatibleAttributes & {
  id: number;
  update: (values: Partial<AuthCompatibleAttributes>) => Promise<unknown>;
};

// Il vincolo generico è su TAttrs (gli attributi), non direttamente
// sull'istanza: la FIRMA esterna resta pienamente tipizzata su TAttrs, così
// chiamare authenticate() con un modello incompatibile resta un errore di
// compilazione. All'INTERNO del corpo della funzione, però, Sequelize non
// riesce a risolvere `TAttrs['email']` come una `string` semplice finché
// TAttrs è ancora un parametro generico "aperto" (limite noto dei tipi
// generici di TypeScript sugli indexed access non risolti) — per questo,
// più sotto, il corpo lavora su un cast verso il tipo concreto
// AuthCompatibleAttributes invece che su TAttrs direttamente.
async function authenticate<TAttrs extends AuthCompatibleAttributes>(
  entityModel: ModelStatic<Model<TAttrs, TAttrs>>,
  email: string,
  password: string
): Promise<AuthResult> {
  // Fallisce subito, con un errore chiaro, se entityModel non ha le colonne
  // che il resto di questa funzione assume (vedi services/authContract.ts).
  // Il vincolo generico su TAttrs protegge già i chiamanti .ts a
  // compile-time; questo controllo resta come difesa a runtime per i
  // chiamanti ancora .js e per i valori 'any' (decisione loggata in
  // AGENTS.md → Design Decisions Log).
  assertAuthCompatible(entityModel);

  const model = entityModel as unknown as ModelStatic<
    Model<AuthCompatibleAttributes, AuthCompatibleAttributes>
  >;

  const found = await model.findOne({ where: { email } });

  if (!found) {
    return { success: false, message: 'Utente non trovato' };
  }

  const user = found as unknown as AuthUserInstance;

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return { success: false, message: 'Password errata' };
  }

  const token = signToken({ id: user.id, email: user.email });

  // signToken (services/tokenService.ts) applica la stessa scadenza usata
  // da registerService.registerEntity: prima erano due chiamate a jwt.sign()
  // separate, ed erano finite per divergere (login senza scadenza,
  // registrazione con scadenza di un'ora).
  await user.update({ current_token: token });

  return { success: true, token };
}

export { authenticate };