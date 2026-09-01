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