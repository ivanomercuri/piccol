// CredentialsService in isolamento: logica di sicurezza condivisa da User e
// Customer. Eredita i test di tokenService.test.ts sulla firma dei token e
// quelli di authService/registerService sul confronto delle password, spostati
// qui in F3 insieme alla responsabilità.
import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { CredentialsService } from '../modules/auth/credentials.service';
import { TEST_JWT_SECRET, testJwtModule } from './helpers/testJwtModule';

describe('CredentialsService', () => {
  let credentials: CredentialsService;

  // Funzione di salvataggio del token finta: CredentialsService non sa quale
  // tabella aggiornare, lo decide il service di ciascuna identità.
  let persistToken: jest.Mock;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [testJwtModule()],
      providers: [CredentialsService],
    }).compile();

    credentials = moduleRef.get(CredentialsService);

    persistToken = jest.fn().mockResolvedValue(undefined);
  });

  describe('password', () => {
    // L'hash non deve mai coincidere con la password in chiaro, e deve
    // comunque permettere di riconoscerla (e solo lei).
    it('produce un hash diverso dal testo, che riconosce solo la password giusta', async () => {
      const hash = await credentials.hashPassword('password123');

      expect(hash).not.toBe('password123');

      await expect(credentials.passwordMatches('password123', hash)).resolves.toBe(true);

      await expect(credentials.passwordMatches('password124', hash)).resolves.toBe(false);
    });
  });

  describe('authenticate', () => {
    const entity = async () => ({
      id: 3,
      email: 'mario@example.com',
      password: await credentials.hashPassword('password123'),
    });

    // Il "non trovato" fa parte dell'esito dell'autenticazione e ha un solo
    // punto in cui produce il suo messaggio, per entrambe le identità.
    it('senza entità lancia "Utente non trovato" e non salva nessun token', async () => {
      await expect(credentials.authenticate(null, 'x', persistToken)).rejects.toThrow(
        new UnauthorizedException('Utente non trovato')
      );

      expect(persistToken).not.toHaveBeenCalled();
    });

    // Un tentativo fallito non deve salvare token: altrimenti chiunque
    // conosca un'email potrebbe invalidare la sessione del titolare.
    it('con password errata lancia "Password errata" e non salva nessun token', async () => {
      await expect(
        credentials.authenticate(await entity(), 'sbagliata', persistToken)
      ).rejects.toThrow(new UnauthorizedException('Password errata'));

      expect(persistToken).not.toHaveBeenCalled();
    });

    // Caso base: il token restituito è lo stesso che viene salvato, legato
    // all'id dell'entità autenticata.
    it('con credenziali corrette restituisce il token e lo salva per l\'entità', async () => {
      const token = await credentials.authenticate(await entity(), 'password123', persistToken);

      expect(persistToken).toHaveBeenCalledWith(3, token);
    });
  });

  describe('issueTokenFor', () => {
    // Il payload è sempre { id, email }: è ciò che JwtUserStrategy legge per
    // ritrovare l'utente.
    it('firma un token con payload { id, email }', async () => {
      const token = await credentials.issueTokenFor({ id: 9, email: 'a@b.it' }, persistToken);

      const payload = jwt.verify(token, TEST_JWT_SECRET) as JwtPayload;

      expect(payload).toEqual(expect.objectContaining({ id: 9, email: 'a@b.it' }));
    });

    // La scadenza arriva dalla configurazione (qui "1h"), non da un valore
    // scritto nel codice: è il test che una volta stava in tokenService.test.ts.
    it('applica la scadenza configurata', async () => {
      const token = await credentials.issueTokenFor({ id: 9, email: 'a@b.it' }, persistToken);

      const payload = jwt.decode(token) as JwtPayload;

      expect(payload.exp! - payload.iat!).toBe(3600);
    });

    // Algoritmo fissato a HS256 in AuthModule: la strategia accetta solo
    // quello, quindi la firma deve usare esattamente quello.
    it('firma con l\'algoritmo HS256 e con il segreto configurato, non con uno qualsiasi', async () => {
      const token = await credentials.issueTokenFor({ id: 9, email: 'a@b.it' }, persistToken);

      expect(jwt.decode(token, { complete: true })?.header.alg).toBe('HS256');

      expect(() => jwt.verify(token, 'un-altro-segreto')).toThrow();
    });
  });
});
