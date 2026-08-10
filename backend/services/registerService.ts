import bcrypt from 'bcryptjs';
import { Model, ModelStatic } from 'sequelize';
import { signToken } from './tokenService';
import { assertAuthCompatible, AuthCompatibleAttributes } from './authContract';

// Dati in ingresso per la registrazione: sempre almeno `password` (usata per
// l'hashing, poi esclusa dal resto dei campi passati a .create()), più
// qualunque altro campo specifico dell'entità (firstName/lastName/address
// per Customer, name per User, ...) — da qui l'indice `[key: string]:
// unknown`, che riflette esattamente la genericità che il file .js
// originale aveva implicitamente (nessun controllo sui campi extra).
interface RegisterUserData {
  password: string;
  [key: string]: unknown;
}

// Vedi services/authService.ts per la spiegazione dello stesso pattern
// (vincolo generico su TAttrs nella firma esterna, cast verso il tipo
// concreto AuthCompatibleAttributes nel corpo, motivato dallo stesso limite
// di TypeScript sugli indexed access non risolti su un parametro generico
// ancora aperto).
async function registerEntity<TAttrs extends AuthCompatibleAttributes>(
  entityModel: ModelStatic<Model<TAttrs, TAttrs>>,
  userData: RegisterUserData,
  tokenPayloadFields: string[]
): Promise<string> {
  // Fallisce subito, con un errore chiaro, se entityModel non ha le colonne
  // che il resto di questa funzione assume (vedi services/authContract.ts).
  assertAuthCompatible(entityModel);

  const model = entityModel as unknown as ModelStatic<
    Model<AuthCompatibleAttributes, AuthCompatibleAttributes>
  >;

  const { password, ...otherFields } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);

  const created = await model.create({
    ...otherFields,
    password: hashedPassword,
  } as AuthCompatibleAttributes);

  // Stesso motivo del cast in authService.ts: le istanze restituite da
  // Sequelize espongono i campi dichiarati come proprietà dot-accessibili
  // dirette a runtime, ma il tipo concreto usato sopra per far
  // type-checkare .create() non lo garantisce staticamente.
  const newEntity = created as unknown as Record<string, unknown> & {
    update: (values: Partial<AuthCompatibleAttributes>) => Promise<unknown>;
  };

  const tokenPayload: Record<string, unknown> = {};

  for (const field of tokenPayloadFields) {
    tokenPayload[field] = newEntity[field];
  }

  // signToken (services/tokenService.ts) è lo stesso punto usato da
  // authService.authenticate: un solo posto dove la scadenza del token è
  // decisa, per non lasciare che le due funzioni tornino a divergere.
  const token = signToken(tokenPayload);

  await newEntity.update({ current_token: token });

  return token;
}

export { registerEntity };