import { Model, ModelStatic } from 'sequelize';

// Interfaccia "gemella" statica di REQUIRED_FIELDS qui sotto: descrive a
// livello di TIPO lo stesso contratto che assertAuthCompatible verifica a
// RUNTIME. Le due cose vanno tenute manualmente in sincronia se il
// contratto dovesse mai cambiare (decisione presa esplicitamente — vedi il
// Design Decisions Log in AGENTS.md — di mantenere entrambe le difese
// invece di affidarsi solo ai tipi statici).
export interface AuthCompatibleAttributes {
  email: string;
  password: string;
  current_token: string | null;
}

// Campi che authService.authenticate e registerService.registerEntity
// assumono sempre presenti su qualunque modello Sequelize passato come
// entityModel: current_token per il pattern di invalidazione del token
// (vedi CLAUDE.md), email/password per il login/registrazione stessi.
const REQUIRED_FIELDS: Array<keyof AuthCompatibleAttributes> = [
  'email',
  'password',
  'current_token',
];

// Generico su M invece di ModelStatic<Model> fisso: authenticate/
// registerEntity chiamano questa funzione con `entityModel` già vincolato a
// `ModelStatic<TInstance extends Model & AuthCompatibleAttributes>` (il
// vincolo statico introdotto in questa stessa fase) — restare generici qui
// evita di dover discutere la varianza tra i due tipi, accettando
// qualunque ModelStatic in ingresso, esattamente come faceva la versione
// .js che non aveva alcun vincolo sul parametro.
function assertAuthCompatible<M extends Model>(
  entityModel: ModelStatic<M>
): void {
  const attributes = entityModel.getAttributes();

  const missing = REQUIRED_FIELDS.filter((field) => !(field in attributes));

  if (missing.length > 0) {
    throw new Error(
      `Il modello "${entityModel.name}" non è compatibile con authService/registerService: mancano i campi ${missing.join(', ')}`
    );
  }
}

export { assertAuthCompatible, REQUIRED_FIELDS };