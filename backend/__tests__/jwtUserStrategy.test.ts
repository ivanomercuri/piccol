// JwtUserStrategy.validate in isolamento: la parte del controllo del token
// specifica del progetto. Firma e scadenza sono verificate prima, da
// passport-jwt; il loro esito è coperto dai test end-to-end di userRoutes.
// Eredita i casi di authUserMiddleware.test.ts che riguardano l'utente e
// current_token.
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { JwtUserStrategy } from '../modules/auth/jwt-user.strategy';

describe('JwtUserStrategy.validate', () => {
  const fakePrisma = { user: { findUnique: jest.fn() } };

  const fakeConfig = { getOrThrow: () => 'segreto-di-test' } as unknown as ConfigService;

  // Costruita con `new`: il costruttore registra la strategia in passport, ma
  // qui interessa solo validate(), che è un metodo normale.
  const strategy = new JwtUserStrategy(fakeConfig, fakePrisma as unknown as PrismaClient);

  function requestWithToken(token: string): Request {
    return { headers: { authorization: `Bearer ${token}` } } as Request;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Caso base: il token della richiesta è quello salvato sull'utente. Ciò che
  // validate() restituisce diventa request.user.
  it('restituisce l\'utente se il token coincide con current_token', async () => {
    const user = { id: 1, current_token: 'abc' };

    fakePrisma.user.findUnique.mockResolvedValue(user);

    await expect(strategy.validate(requestWithToken('abc'), { id: 1 })).resolves.toBe(user);
  });

  // Il cuore del pattern di invalidazione: una firma valida non basta, il
  // token deve essere l'ultimo emesso. Un token precedente, anche integro,
  // va rifiutato.
  it('rifiuta un token valido ma diverso da current_token', async () => {
    fakePrisma.user.findUnique.mockResolvedValue({ id: 1, current_token: 'token-nuovo' });

    await expect(strategy.validate(requestWithToken('token-vecchio'), { id: 1 })).rejects.toThrow(
      new UnauthorizedException('Token non più valido')
    );
  });

  // Dopo il logout current_token è null: nessun token può corrispondere.
  it('rifiuta qualunque token dopo il logout (current_token null)', async () => {
    fakePrisma.user.findUnique.mockResolvedValue({ id: 1, current_token: null });

    await expect(strategy.validate(requestWithToken('abc'), { id: 1 })).rejects.toThrow(
      new UnauthorizedException('Token non più valido')
    );
  });

  // Token integro di un utente cancellato nel frattempo.
  it('rifiuta il token di un utente che non esiste più', async () => {
    fakePrisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(requestWithToken('abc'), { id: 99 })).rejects.toThrow(
      new UnauthorizedException('Utente non trovato')
    );
  });

  // Difesa in più: un payload senza un id intero non deve arrivare a Prisma,
  // dove produrrebbe un 500 invece di un 401.
  it('rifiuta un payload senza id intero, senza interrogare il database', async () => {
    await expect(strategy.validate(requestWithToken('abc'), { id: '1' })).rejects.toThrow(
      new UnauthorizedException('Token scaduto o non valido')
    );

    expect(fakePrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
