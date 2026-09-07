/**
 * Punto unico in cui vive la regola "l'email identifica un'entità in modo
 * case-insensitive": va applicata sia in scrittura (registrazione,
 * aggiornamento profilo) sia in lettura (login), altrimenti un'email salvata
 * in minuscolo non verrebbe più ritrovata cercandola come l'utente l'ha
 * digitata.
 *
 * PERCHÉ ESISTE QUESTO FILE (migrazione MySQL -> PostgreSQL)
 * Su MySQL la collation di default è case-insensitive: "Mario@x.com" e
 * "mario@x.com" erano lo stesso valore, quindi il vincolo UNIQUE su email
 * rifiutava la seconda registrazione e il login funzionava con qualunque
 * combinazione di maiuscole. PostgreSQL confronta le stringhe in modo
 * case-sensitive: senza normalizzazione le due email diventerebbero due
 * account distinti per la stessa persona reale, ognuno con il proprio
 * current_token — rendendo di fatto inefficace il pattern di invalidazione
 * del token descritto in CLAUDE.md.
 *
 * PERCHÉ UNA FUNZIONE ESPLICITA E NON UN HOOK SEQUELIZE
 * Un hook `beforeSave` sui modelli sarebbe più "automatico", ma
 * normalizzerebbe solo in scrittura (il login cerca con findOne, che non
 * passa da lì) e soprattutto renderebbe la regola invisibile nel punto in
 * cui viene applicata — stato nascosto invece di una dipendenza esplicita.
 * Il progetto inoltre non usa hook da nessuna parte: introdurne uno solo
 * qui creerebbe un precedente incoerente.
 */
function normalizeEmail(email: string): string {
  // Solo toLowerCase, deliberatamente NON trim(): uno spazio in coda produce
  // un valore diverso sia su MySQL sia su PostgreSQL, quindi non fa parte
  // della differenza di comportamento che questa migrazione deve sanare.
  // Aggiungerlo qui cambierebbe il comportamento oltre a quanto deciso,
  // in un punto che tocca l'autenticazione.
  return email.toLowerCase();
}

export { normalizeEmail };
