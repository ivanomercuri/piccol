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

    // DECISIONE B: account inesistente e password errata producono lo STESSO
    // messaggio. Fino a F3 erano "Utente non trovato" e "Password errata",
    // che rivelavano quali email sono registrate.
    it('dà lo stesso messaggio per account inesistente e password errata, senza salvare token', async () => {
      const existing = await entity();

      // I due login si avviano e si attendono UNO ALLA VOLTA, ciascuno dentro
      // il proprio expect. Avviarli entrambi e attenderli dopo sarebbe un
      // errore: mentre si attende il primo, il secondo può essere già
      // rifiutato senza che nessuno lo stia ancora ascoltando, e Jest lo
      // segnala come rifiuto non gestito facendo fallire il test.
      await expect(credentials.authenticate(null, 'x', persistToken)).rejects.toThrow(
        new UnauthorizedException('Credenziali non valide')
      );

      await expect(credentials.authenticate(existing, 'sbagliata', persistToken)).rejects.toThrow(
        new UnauthorizedException('Credenziali non valide')
      );

      // Un tentativo fallito non deve salvare token: altrimenti chiunque
      // conosca un'email potrebbe invalidare la sessione del titolare.
      expect(persistToken).not.toHaveBeenCalled();
    });

    // Il messaggio unico non basta: se per un account inesistente si
    // rispondesse senza eseguire bcrypt, la risposta sarebbe molto più veloce
    // e rivelerebbe comunque che l'email non esiste. Il test non misura tempi,
    // che in una suite sarebbero instabili: verifica che il lavoro costoso
    // venga svolto anche quando l'account manca.
    it('esegue il confronto della password anche quando l\'account non esiste', async () => {
      const compare = jest.spyOn(credentials, 'passwordMatches');

      await expect(credentials.authenticate(null, 'qualunque', persistToken)).rejects.toThrow();

      expect(compare).toHaveBeenCalledWith('qualunque', expect.stringMatching(/^\$2[aby]\$10\$/));
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
