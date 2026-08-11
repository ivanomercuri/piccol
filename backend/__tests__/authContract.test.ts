// authContract è il controllo esplicito introdotto perché authService e
// registerService assumevano implicitamente che qualunque entityModel
// passato avesse email/password/current_token, senza mai verificarlo (vedi
// services/authContract.ts). Qui testiamo assertAuthCompatible in
// isolamento, sui vari modi in cui un modello può essere compatibile o meno.
import { Model, ModelStatic } from 'sequelize';
import {
  assertAuthCompatible,
  REQUIRED_FIELDS,
  AuthCompatibleAttributes,
} from '../services/authContract';

// assertAuthCompatible è generica su `ModelStatic<M>` — un vero modello
// Sequelize ha decine di membri statici (init, findAll, associations, ...)
// che questi oggetti letterali "finti" non hanno. Il cast riflette che
// stiamo testando solo il comportamento RUNTIME della funzione (legge
// `.name` e chiama `.getAttributes()`), non la conformità completa al tipo
// ModelStatic — esattamente ciò che il file .js originale faceva passando
// oggetti letterali senza alcun controllo statico.
type FakeModel = ModelStatic<Model>;

describe('authContract.assertAuthCompatible', () => {
  it('should not throw for a model with all required fields (e.g. shaped like User)', () => {
    const userLikeModel = {
      name: 'User',
      getAttributes: () => ({
        id: {},
        name: {},
        email: {},
        level: {},
        password: {},
        current_token: {},
      }),
    } as unknown as FakeModel;

    expect(() => assertAuthCompatible(userLikeModel)).not.toThrow();
  });

  it('should not throw for a model with all required fields (e.g. shaped like Customer)', () => {
    const customerLikeModel = {
      name: 'Customer',
      getAttributes: () => ({
        email: {},
        password: {},
        current_token: {},
        firstName: {},
        lastName: {},
        address: {},
      }),
    } as unknown as FakeModel;

    expect(() => assertAuthCompatible(customerLikeModel)).not.toThrow();
  });

  it.each(REQUIRED_FIELDS)(
    'should throw a clear error naming the model and the field when "%s" is missing',
    (missingField: keyof AuthCompatibleAttributes) => {
      const attributes: Partial<Record<keyof AuthCompatibleAttributes, object>> =
        { email: {}, password: {}, current_token: {} };

      delete attributes[missingField];

      const incompleteModel = {
        name: 'BrokenModel',
        getAttributes: () => attributes,
      } as unknown as FakeModel;

      expect(() => assertAuthCompatible(incompleteModel)).toThrow(
        `Il modello "BrokenModel" non è compatibile con authService/registerService: mancano i campi ${missingField}`
      );
    }
  );

  it('should list ALL missing fields in the error message, not just the first one', () => {
    const emptyModel = {
      name: 'EmptyModel',
      getAttributes: () => ({}),
    } as unknown as FakeModel;

    expect(() => assertAuthCompatible(emptyModel)).toThrow(
      'mancano i campi email, password, current_token'
    );
  });
});