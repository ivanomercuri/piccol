import { Model, ModelStatic } from 'sequelize';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authenticate } from '../services/authService';
import { AuthCompatibleAttributes } from '../services/authContract';

// getAttributes() simula la forma di un modello Sequelize "compatibile":
// authService.assertAuthCompatible (services/authContract.ts) la interroga
// prima di procedere, per verificare che email/password/current_token siano
// colonne reali del modello. Senza questo, ogni test qui sotto fallirebbe
// subito con "Il modello ... non è compatibile...".
const compatibleAttributes = () => ({
  email: {},
  password: {},
  current_token: {},
});

// authenticate() è generica su ModelStatic<Model<TAttrs, TAttrs>> — un vero
// modello Sequelize ha decine di membri statici che questi oggetti letterali
// "finti" non hanno. Il cast riflette che stiamo testando solo il
// comportamento RUNTIME di authenticate (findOne/update mockati con
// jest.fn()), non la conformità completa al tipo ModelStatic.
type FakeModel = ModelStatic<
  Model<AuthCompatibleAttributes, AuthCompatibleAttributes>
>;

describe('authService.authenticate', () => {
  it('returns success and token if credentials are correct', async () => {
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: await bcrypt.hash('password', 10),
      update: jest.fn(),
    };

    const entityModel = {
      name: 'FakeEntity',
      getAttributes: compatibleAttributes,
      findOne: jest.fn().mockResolvedValue(fakeUser),
    } as unknown as FakeModel;

    process.env.JWT_SECRET = 'testsecret';

    const result = await authenticate(
      entityModel,
      'test@example.com',
      'password'
    );

    expect(result.success).toBe(true);

    expect(result.token).toBeDefined();

    expect(fakeUser.update).toHaveBeenCalled();
  });

  it('fails if user is not found', async () => {
    const entityModel = {
      name: 'FakeEntity',
      getAttributes: compatibleAttributes,
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as FakeModel;

    const result = await authenticate(
      entityModel,
      'notfound@example.com',
      'password'
    );

    expect(result.success).toBe(false);
  });

  it('fails if password is incorrect', async () => {
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: await bcrypt.hash('password', 10),
      update: jest.fn(),
    };

    const entityModel = {
      name: 'FakeEntity',
      getAttributes: compatibleAttributes,
      findOne: jest.fn().mockResolvedValue(fakeUser),
    } as unknown as FakeModel;

    const result = await authenticate(entityModel, 'test@example.com', 'wrong');

    expect(result.success).toBe(false);
  });

  it('issues a token that expires in 1 hour, same policy as registerEntity', async () => {
    // Prima di questa modifica authenticate() firmava un token SENZA
    // scadenza (asimmetria rispetto a registerEntity, documentata come
    // "problema noto" in backend/docs/API.md): ora entrambi passano dallo
    // stesso signToken (services/tokenService.ts) e devono avere lo stesso
    // claim `exp`.
    const fakeUser = {
      id: 1,
      email: 'test@example.com',
      password: await bcrypt.hash('password', 10),
      update: jest.fn(),
    };

    const entityModel = {
      name: 'FakeEntity',
      getAttributes: compatibleAttributes,
      findOne: jest.fn().mockResolvedValue(fakeUser),
    } as unknown as FakeModel;

    process.env.JWT_SECRET = 'testsecret';

    const result = await authenticate(
      entityModel,
      'test@example.com',
      'password'
    );

    const decoded = jwt.decode(result.token as string) as JwtPayload;

    expect(decoded.exp).toBeDefined();

    // ~1 ora di validità (3600s), con un margine per i tempi di esecuzione
    // del test.
    expect(decoded.exp! - decoded.iat!).toBeCloseTo(3600, -1);
  });

  it('throws immediately if entityModel is missing a required auth field', async () => {
    // Un modello "incompatibile" (qui: senza current_token) deve far
    // fallire subito, con un errore chiaro — non silenziosamente più avanti
    // nella funzione (vedi services/authContract.ts).
    const entityModel = {
      name: 'IncompleteModel',
      getAttributes: () => ({ email: {}, password: {} }),
      findOne: jest.fn(),
    } as unknown as FakeModel;

    await expect(
      authenticate(entityModel, 'test@example.com', 'password')
    ).rejects.toThrow(/IncompleteModel.*current_token/);

    // Non deve nemmeno arrivare a interrogare il DB.
    expect(entityModel.findOne).not.toHaveBeenCalled();
  });
});