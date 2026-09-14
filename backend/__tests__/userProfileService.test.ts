// UserProfileService in isolamento. Il punto di questi test è soprattutto
// uno: dal profilo non devono MAI uscire l'hash della password né il token
// corrente.
import { PrismaClient, User } from '@prisma/client';
import { UserProfileService } from '../modules/user/user-profile.service';

describe('UserProfileService', () => {
  const fakePrisma = { user: { update: jest.fn() } };

  // `new` e non il TestingModule: il service ha una sola dipendenza, e qui
  // non c'è un collegamento del container da verificare che gli altri test
  // non verifichino già.
  const service = new UserProfileService(fakePrisma as unknown as PrismaClient);

  const row = {
    id: 1,
    name: 'Mario',
    email: 'mario@example.com',
    password: '$2b$10$hash-che-non-deve-uscire',
    level: 'superadmin',
    current_token: 'token-che-non-deve-uscire',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Il confronto è sull'insieme ESATTO delle chiavi: un campo in più (oggi o
  // dopo una modifica allo schema) fa fallire il test, invece di passare
  // inosservato.
  it('restituisce solo id, name, email e level', () => {
    expect(service.getProfile(row)).toEqual({
      id: 1,
      name: 'Mario',
      email: 'mario@example.com',
      level: 'superadmin',
    });
  });

  // L'email scritta dal profilo va normalizzata come in registrazione,
  // altrimenti l'utente non riuscirebbe più a fare login. La risposta, come
  // nel legacy, non include `level` e mai i campi riservati.
  it('aggiorna con l\'email normalizzata e restituisce solo id, name ed email', async () => {
    fakePrisma.user.update.mockResolvedValue({ ...row, name: 'Nuovo', email: 'nuovo@example.com' });

    const result = await service.updateProfile(1, { name: 'Nuovo', email: 'Nuovo@Example.com' });

    expect(fakePrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Nuovo', email: 'nuovo@example.com' },
    });

    expect(result).toEqual({ id: 1, name: 'Nuovo', email: 'nuovo@example.com' });
  });
});
