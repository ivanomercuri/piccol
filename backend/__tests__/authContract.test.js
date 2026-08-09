// authContract è il controllo esplicito introdotto perché authService e
// registerService assumevano implicitamente che qualunque entityModel
// passato avesse email/password/current_token, senza mai verificarlo (vedi
// services/authContract.js). Qui testiamo assertAuthCompatible in
// isolamento, sui vari modi in cui un modello può essere compatibile o meno.
const { assertAuthCompatible, REQUIRED_FIELDS } = require('../services/authContract');

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
    };

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
    };

    expect(() => assertAuthCompatible(customerLikeModel)).not.toThrow();
  });

  it.each(REQUIRED_FIELDS)(
    'should throw a clear error naming the model and the field when "%s" is missing',
    (missingField) => {
      const attributes = { email: {}, password: {}, current_token: {} };

      delete attributes[missingField];

      const incompleteModel = {
        name: 'BrokenModel',
        getAttributes: () => attributes,
      };

      expect(() => assertAuthCompatible(incompleteModel)).toThrow(
        `Il modello "BrokenModel" non è compatibile con authService/registerService: mancano i campi ${missingField}`
      );
    }
  );

  it('should list ALL missing fields in the error message, not just the first one', () => {
    const emptyModel = {
      name: 'EmptyModel',
      getAttributes: () => ({}),
    };

    expect(() => assertAuthCompatible(emptyModel)).toThrow(
      'mancano i campi email, password, current_token'
    );
  });
});