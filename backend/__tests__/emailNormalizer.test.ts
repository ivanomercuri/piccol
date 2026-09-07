// emailNormalizer è nato con la migrazione da MySQL a PostgreSQL: MySQL
// confrontava le stringhe in modo case-insensitive di default, PostgreSQL no,
// quindi la regola "l'email identifica un'entità a prescindere dalle
// maiuscole" ha dovuto smettere di essere un effetto collaterale della
// collation del database e diventare codice esplicito. Questi test fissano
// esattamente quel contratto, così una modifica futura non lo indebolisce
// senza accorgersene.
import { normalizeEmail } from '../services/emailNormalizer';

describe('emailNormalizer.normalizeEmail', () => {
  // Il caso che motiva l'intera funzione: su PostgreSQL queste due forme
  // sarebbero due valori distinti, e quindi due account distinti per la
  // stessa persona.
  it('should lowercase an email written with mixed case', () => {
    expect(normalizeEmail('Mario@Example.COM')).toBe('mario@example.com');
  });

  // Un'email già in minuscolo non deve essere alterata: garantisce che la
  // funzione sia idempotente, cioè che applicarla due volte (in scrittura e
  // poi di nuovo in lettura) dia sempre lo stesso risultato.
  it('should leave an already lowercase email unchanged', () => {
    expect(normalizeEmail('mario@example.com')).toBe('mario@example.com');
  });

  // Fissa deliberatamente una NON-funzionalità: gli spazi non vengono
  // rimossi. Uno spazio in coda produce un valore diverso sia su MySQL sia
  // su PostgreSQL, quindi non fa parte della differenza che questa
  // migrazione doveva sanare — aggiungere un trim() qui cambierebbe il
  // comportamento dell'autenticazione oltre a quanto deciso.
  it('should not trim surrounding whitespace (deliberate, not an oversight)', () => {
    expect(normalizeEmail(' mario@example.com ')).toBe(' mario@example.com ');
  });

  // Input vuoto: non deve lanciare, restituisce una stringa vuota. Chi
  // chiama (registerService/authService) non fa controlli aggiuntivi, quindi
  // la funzione non deve introdurre un nuovo punto di rottura.
  it('should return an empty string unchanged instead of throwing', () => {
    expect(normalizeEmail('')).toBe('');
  });
});
