// AuthUserGuard in isolamento: l'intero percorso di autenticazione di una
// rotta protetta, dall'header al confronto con current_token.
//
// Dalla fase F7 il guard è scritto a mano e questo file copre anche i casi che
// stavano in jwtUserStrategy.test.ts (rimosso con la strategia passport): i
// cinque messaggi del 401 nascono tutti qui.
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClient, User } from '@prisma/client';
import { AuthUserGuard } from '../modules/auth/auth-user.guard';
import { AuthenticatedRequest } from '../modules/auth/authenticated-request';
import { testJwtModule } from './helpers/testJwtModule';

describe('AuthUserGuard', () => {
  // Prisma finto con il solo delegate `user`: come per gli altri test, la
  // separazione fra le due identità è verificata dalla forma dell'oggetto.
  const fakePrisma = { user: { findUnique: jest.fn() } };

  let guard: AuthUserGuard;
  let jwt: JwtService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // TestingModule e non `new AuthUserGuard(...)`: verifica anche che NestJS
    // sappia risolvere il costruttore del guard (JwtService + PrismaClient).
    const moduleRef = await Test.createTestingModule({
      imports: [testJwtModule()],
      providers: [AuthUserGuard, { provide: PrismaClient, useValue: fakePrisma }],
    }).compile();

    guard = moduleRef.get(AuthUserGuard);

    jwt = moduleRef.get(JwtService);
  });

  // La richiesta che il guard riceve: solo gli header contano in entrata.
  function requestWith(authorization?: string): AuthenticatedRequest {
    return { headers: { authorization } };
  }

  function contextFor(request: AuthenticatedRequest): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  // Un utente come lo restituirebbe il database, con il token indicato come
  // unico token valido.
  function userRow(currentToken: string | null): User {
    return { id: 7, email: 'admin@example.com', current_token: currentToken } as User;
  }

  // Il messaggio del 401, per non ripetere try/catch in ogni test.
  async function rejectionFor(request: AuthenticatedRequest): Promise<string> {
    try {
      await guard.canActivate(contextFor(request));
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);

      return (error as UnauthorizedException).message;
    }

    throw new Error('Attesa una UnauthorizedException');
  }

  // Caso base: token valido e uguale a current_token. L'utente finisce sulla
  // richiesta, da dove lo legge @CurrentUser().
  it('accetta un token valido e mette l\'utente sulla richiesta', async () => {
    const token = await jwt.signAsync({ id: 7, email: 'admin@example.com' });

    fakePrisma.user.findUnique.mockResolvedValue(userRow(token));

    const request = requestWith(`Bearer ${token}`);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.user).toEqual(userRow(token));

    expect(fakePrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  // Header assente e header presente ma nella forma sbagliata sono due errori
  // distinti: il client sa quale dei due ha fatto.
  it('distingue header mancante e formato non valido', async () => {
    await expect(rejectionFor(requestWith(undefined))).resolves.toBe('Token mancante');

    await expect(rejectionFor(requestWith('token-senza-schema'))).resolves.toBe(
      'Formato token non valido'
    );

    await expect(rejectionFor(requestWith('Bearer '))).resolves.toBe('Formato token non valido');
  });

  // Lo schema Bearer è obbligatorio (RFC 6750), a differenza del middleware
  // legacy che prendeva la seconda parola qualunque fosse lo schema.
  it('rifiuta un token valido inviato con uno schema diverso da Bearer', async () => {
    const token = await jwt.signAsync({ id: 7 });

    await expect(rejectionFor(requestWith(`Basic ${token}`))).resolves.toBe(
      'Formato token non valido'
    );

    // Lo schema è riconosciuto senza distinzione di maiuscole.
    fakePrisma.user.findUnique.mockResolvedValue(userRow(token));

    await expect(guard.canActivate(contextFor(requestWith(`bearer ${token}`)))).resolves.toBe(true);
  });

  // Firma fatta con un altro segreto, token illeggibile, token scaduto: un
  // solo messaggio, che non dice a chi attacca quanto si è avvicinato. E il
  // database non viene nemmeno interrogato.
  it('rifiuta con un unico messaggio i token non verificabili', async () => {
    const altroSegreto = new JwtService({ secret: 'un-altro-segreto' });

    const firmatoAltrove = await altroSegreto.signAsync({ id: 7 });

    await expect(rejectionFor(requestWith(`Bearer ${firmatoAltrove}`))).resolves.toBe(
      'Token scaduto o non valido'
    );

    await expect(rejectionFor(requestWith('Bearer non-un-jwt'))).resolves.toBe(
      'Token scaduto o non valido'
    );

    const scaduto = await jwt.signAsync({ id: 7 }, { expiresIn: '-1s' });

    await expect(rejectionFor(requestWith(`Bearer ${scaduto}`))).resolves.toBe(
      'Token scaduto o non valido'
    );

    expect(fakePrisma.user.findUnique).not.toHaveBeenCalled();
  });

  // Un payload senza id intero non deve arrivare alla query di Prisma, che
  // fallirebbe con un 500 invece di un 401.
  it('rifiuta un token il cui payload non ha un id intero', async () => {
    const strano = await jwt.signAsync({ id: 'sette' });

    await expect(rejectionFor(requestWith(`Bearer ${strano}`))).resolves.toBe(
      'Token scaduto o non valido'
    );

    expect(fakePrisma.user.findUnique).not.toHaveBeenCalled();
  });

  // L'utente è stato cancellato dopo l'emissione del token.
  it('rifiuta il token di un utente che non esiste più', async () => {
    const token = await jwt.signAsync({ id: 7 });

    fakePrisma.user.findUnique.mockResolvedValue(null);

    await expect(rejectionFor(requestWith(`Bearer ${token}`))).resolves.toBe('Utente non trovato');
  });

  // Il cuore del pattern di invalidazione: firma valida, ma il token non è più
  // quello registrato sull'utente (logout, o cambio password).
  it('rifiuta un token diverso da current_token, anche se firmato bene', async () => {
    const token = await jwt.signAsync({ id: 7 });

    fakePrisma.user.findUnique.mockResolvedValue(userRow('un-altro-token'));

    await expect(rejectionFor(requestWith(`Bearer ${token}`))).resolves.toBe('Token non più valido');

    fakePrisma.user.findUnique.mockResolvedValue(userRow(null));

    await expect(rejectionFor(requestWith(`Bearer ${token}`))).resolves.toBe('Token non più valido');
  });

  // Un guasto del database non è un problema del client: risale come errore
  // (500 dal filter). Il middleware legacy rispondeva 401 "Token scaduto o non
  // valido", e il client faceva logout invece di riprovare.
  it('lascia risalire un errore del database invece di tradurlo in 401', async () => {
    const token = await jwt.signAsync({ id: 7 });

    const guasto = new Error('connessione rifiutata');

    fakePrisma.user.findUnique.mockRejectedValue(guasto);

    await expect(guard.canActivate(contextFor(requestWith(`Bearer ${token}`)))).rejects.toBe(guasto);
  });
});
