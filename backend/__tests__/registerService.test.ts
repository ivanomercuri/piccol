import { Model, ModelStatic } from 'sequelize';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { registerEntity } from '../services/registerService';
import { AuthCompatibleAttributes } from '../services/authContract';

// Come in authService.test.ts: assertAuthCompatible (services/authContract.ts)
// controlla la forma del modello prima di procedere, quindi il mock deve
// esporre getAttributes() con i campi richiesti.
const compatibleAttributes = () => ({
  email: {},
  password: {},
  current_token: {},
});

// Vedi authService.test.ts per la spiegazione di questo cast: registerEntity
// è generica su ModelStatic<Model<TAttrs, TAttrs>>, un vero modello
// Sequelize ha decine di membri statici che l'oggetto letterale "finto"
// restituito da makeEntityModel() non ha.
type FakeModel = ModelStatic<
  Model<AuthCompatibleAttributes, AuthCompatibleAttributes>
>;

function makeEntityModel(): FakeModel {
  return {
    name: 'FakeEntity',
    getAttributes: compatibleAttributes,
    create: jest.fn().mockImplementation(async (data) => ({
      ...data,
      id: 1,
      update: jest.fn(),
    })),
  } as unknown as FakeModel;
}

describe('registerService.registerEntity', () => {
  it('registers a new user and returns a token', async () => {
    const entityModel = makeEntityModel();

    const userData = {
      name: 'Test',
      email: 'test@example.com',
      password: 'password',
    };

    const tokenPayloadFields = ['id', 'email'];

    const token = await registerEntity(
      entityModel,
      userData,
      tokenPayloadFields
    );

    expect(token).toBeDefined();

    expect(entityModel.create).toHaveBeenCalled();
  });

  // Contraltare in scrittura del test su authService: se la registrazione
  // salvasse l'email così com'è digitata, su PostgreSQL il vincolo UNIQUE
  // non impedirebbe due account per la stessa identità ("Mario@x.com" e
  // "mario@x.com" sarebbero due valori diversi), e il login normalizzato
  // non ritroverebbe comunque la riga.
  it('should persist the email normalized to lowercase', async () => {
    const entityModel = makeEntityModel();

    await registerEntity(
      entityModel,
      {
        name: 'Test',
        email: 'Mario@Example.COM',
        password: 'password',
      },
      ['id', 'email']
    );

    // create() deve ricevere l'email già in minuscolo. Gli altri campi
    // restano intatti: la normalizzazione riguarda solo l'email, non è un
    // "lowercase su tutto l'input" (Category.name e Product.sku restano
    // deliberatamente case-sensitive, vedi Design Decisions Log).
    expect(entityModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test',
        email: 'mario@example.com',
      })
    );
  });

  it('issues a token that expires in 1 hour, same policy as authenticate', async () => {
    const entityModel = makeEntityModel();

    const token = await registerEntity(
      entityModel,
      { name: 'Test', email: 'test@example.com', password: 'password' },
      ['id', 'email']
    );

    const decoded = jwt.decode(token) as JwtPayload;

    expect(decoded.exp).toBeDefined();

    expect(decoded.exp! - decoded.iat!).toBeCloseTo(3600, -1);
  });

  it('throws immediately if entityModel is missing a required auth field', async () => {
    const entityModel = {
      name: 'IncompleteModel',
      getAttributes: () => ({ email: {}, password: {} }),
      create: jest.fn(),
    } as unknown as FakeModel;

    await expect(
      registerEntity(
        entityModel,
        { email: 'test@example.com', password: 'password' },
        ['id', 'email']
      )
    ).rejects.toThrow(/IncompleteModel.*current_token/);

    expect(entityModel.create).not.toHaveBeenCalled();
  });
});