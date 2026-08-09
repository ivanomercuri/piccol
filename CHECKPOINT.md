# CHECKPOINT

Stato del progetto **Piccol** al 2026-07-23, per orientarsi rapidamente in una nuova sessione. Non
sostituisce `CLAUDE.md`/`AGENTS.md` (regole del progetto), `backend/docs/API.md` (documentazione API
dettagliata) né `backend/docs/TESTING.md` (perché/come della suite di test) — li integra con lo stato di
avanzamento del lavoro.

## Completato in questa sessione

**Documentazione e convenzioni**

- Creato `CLAUDE.md` (in italiano): comandi, architettura, pattern del progetto.
- Aggiunta la regola: commenti nel codice **verbosi e in italiano** per ogni funzionalità non banale
  (funzione per funzione, test per test) — deroga esplicita, solo per i commenti, alla convenzione
  "codice/commenti in inglese" di `AGENTS.md`. I nomi di variabili/funzioni restano in inglese.
- Aggiunta la regola: testi Git (commit, PR, branch, commenti su issue/PR) **solo in italiano**.
- Creato `backend/docs/API.md`: documentazione di tutte le rotte REST esistenti, con una sezione
  "Problemi noti" che elenca i comportamenti da tenere a mente (vedi sotto).
- Aggiunta ad `AGENTS.md` la sezione "Data Design & Trade-off Protocol": prima di creare/modificare un
  modello Sequelize o un service che tocca dati condivisi/mutabili, vanno valutate 5 categorie (Time,
  Deletion, Concurrency, Duplication, State) e, se una si applica, presentate le opzioni con pro/contro
  invece di implementare direttamente — più un "Design Decisions Log" per tracciare le scelte prese.
  Applicato concretamente in questa sessione per la discussione sulla centralizzazione della firma dei
  token (vedi sotto).

**Dipendenze e sicurezza**

- Aggiornati tutti i pacchetti npm (backend e frontend) alle ultime versioni, incluse le major
  (`eslint` 9→10, `dotenv` 16→17, `jest` 29→30, `vite` 6→8, ecc.).
- Aggiunta `@eslint/js` come devDependency esplicita nel backend (prima "funzionava per caso" per
  hoisting transitivo da eslint 9, non più garantito con eslint 10).
- Backend a **0 vulnerabilità note**: risolte 8/10 con `npm audit fix`, la nona forzando
  `uuid@^11.1.1` via `overrides` in `package.json` (Sequelize 6.x dipende da `uuid@^8.3.2`, vulnerabile,
  e non esiste ancora una versione stabile di Sequelize che la aggiorni — la 7.x è solo alpha).
- Frontend a 0 vulnerabilità.

**Test**

- Corretto un bug nel pattern `testMatch` di `jest.config.js` che faceva sì che `npm test` eseguisse
  **0 file** invece dei test esistenti (bug introdotto in un commit precedente a questa sessione).
- Una volta sbloccati, 4 test in `validateProductImageMiddleware.test.js` risultavano falliti perché
  scritti per una versione precedente del middleware: riscritti per riflettere il comportamento reale.
- Scoperto che `checkNumberFilesMiddleware` (limite "1 immagine per prodotto") esisteva nel codice ma
  non era mai stato collegato a nessuna route: collegato in `routes/productRoutes.js` e aggiunta una
  suite di test dedicata (`checkNumberFilesMiddleware.test.js`), che prima non esisteva.
- **Espansa la copertura a tutto ciò che non era testato** (richiesta esplicita): aggiunti 21 nuovi
  file in tre categorie — unità con mock (controller e middleware prima a copertura zero, incluso
  `authUserMiddleware`), modelli Sequelize contro un DB reale (`*.model.test.js`: `User`, `Customer`,
  `Product`, `Category`, `ProductImage`, `ProductCategory`), e route end-to-end con supertest
  (`*Routes.test.js`: customer, admin/user, product, debug) che attraversano davvero l'app HTTP fino al
  DB, incluso il pattern di invalidazione del token verificato in modo reale (logout/cambio password
  invalidano il vecchio JWT).
- Infrastruttura nuova necessaria per questo: un **database di test separato**
  (`mydatabase_test`, blocco `test` in `backend/config/config.json`) creato/migrato automaticamente da
  uno script `pretest` prima di ogni `npm test`, isolato dal DB di sviluppo già popolato dal seed.
  Logging SQL disattivato in `NODE_ENV=test` (altrimenti l'output sarebbe illeggibile).
- Il perché/come dettagliato di tutto questo è in `backend/docs/TESTING.md`.
- Suite attuale: **28 file, 134 test, tutti verdi**, verificata anche per idempotenza (ripetibile senza
  sporcare il DB, controllato rieseguendo la suite più volte di seguito).

**Autenticazione: firma dei token centralizzata + contratto esplicito**

- `authService.authenticate` e `registerService.registerEntity` firmavano i JWT separatamente: avevano
  finito per divergere in silenzio (login senza scadenza, registrazione con scadenza di un'ora — la
  "asimmetria" segnalata sotto in una versione precedente di questo file, **ora risolta**).
- Aggiunto `services/tokenService.js`: punto unico di firma (`signToken`), scadenza letta da
  `JWT_EXPIRES_IN` (nuova variabile d'ambiente, in `.env`/`.env.example`) invece che hardcoded — decisione
  presa dopo che l'utente ha fatto notare che è una policy di sicurezza operativa, non una costante di
  codice, quindi va poter cambiare per ambiente senza un redeploy. `DEFAULT_TOKEN_EXPIRES_IN = '1h'` resta
  solo come fallback se la variabile manca.
- Aggiunto `services/authContract.js`: `assertAuthCompatible(entityModel)` verifica che il modello passato
  a `authService`/`registerService` abbia `email`/`password`/`current_token` prima di procedere — prima
  era un contratto implicito mai controllato, un modello incompatibile avrebbe fallito silenziosamente
  più a valle.
- Discussione precedente all'implementazione (vedi il nuovo protocollo in `AGENTS.md`): valutata anche
  l'ipotesi di unire i modelli `User`/`Customer` in uno solo per eliminare la duplicazione — scartata,
  perché romperebbe la FK reale `Product.createdBy → users.id` e la separazione di dominio già
  documentata in CLAUDE.md ("non sono una gerarchia condivisa"). Si è preferito centralizzare solo il
  punto di firma del token, mantenendo i due modelli separati.

**Database**

- Eseguite tutte le migrazioni pendenti (12/12, prima tutte "down").
- Questo ha reso concreto un disallineamento già latente: `models/product.js` dichiarava ancora
  `image_url` (rimosso dalla tabella `products` da una migrazione) e non dichiarava `sku` (aggiunto da
  un'altra migrazione, mai esposto). **Corretto** — verificato con query dirette (`Product.findAll()`
  falliva con "Unknown column 'image_url'" prima del fix, ora funziona).
- Aggiunti i modelli Sequelize mancanti per **Category**, **ProductImage**, **ProductCategory**
  (tabelle esistenti via migrazioni ma senza modello — gap segnalato in `CLAUDE.md`), con le relative
  associazioni su `Product` (`hasMany` immagini, `belongsToMany` categorie). Verificato con query reali
  che usano `include` su entrambe le relazioni.
- Eseguiti i seeder: **3 utenti** in `users` — `master@example.com` (superadmin),
  `mario@example.com` (admin), `luigi@example.com` (admin), password `password123` per tutti.

**Postman**

- Confrontata `API 1 Piccol.postman_collection.json` con le rotte reali: tutti i 12 endpoint erano
  presenti e corretti (metodo, path), ma con alcune discrepanze corrette:
  - "New Product" — mancavano i 4 campi testuali obbligatori (`name`, `description`, `price`,
    `quantity`); il file di esempio era un `.webp`, rifiutato dal backend (solo JPG/PNG).
  - "Register User" — valore placeholder scorretto nel campo `name`.
  - "Logged User" — body JSON superfluo su una GET.
  - Aggiunto uno script di test su "Login User" che salva il token JWT come collection variable
    `token`: le richieste protette lo trovano già valorizzato, senza copia/incolla manuale.

**Git**

- Configurata una chiave SSH ed25519 su questa macchina e aggiunta all'account GitHub
  `ivanomercuri`, necessaria perché non ce n'era nessuna (il push falliva con
  "Permission denied (publickey)").
- **13 commit pushati su `origin/main`** finora (da `ccc57bb` a `46eff2e`, tutti con messaggi in
  italiano) al momento in cui questo file è stato aggiornato — controlla `git log --oneline` /
  `git log origin/main..HEAD` per lo stato reale, dato che il lavoro continua oltre questo checkpoint.
- Commit correlati fatti nella stessa sessione ma non ancora pushati sono stati a volte **uniti in un
  solo commit** (`git reset --soft` + ricommit) su richiesta esplicita, invece di restare separati —
  utile saperlo se in futuro serve capire perché la cronologia non rispecchia 1:1 ogni singolo passaggio
  fatto.

## Su cosa NON abbiamo lavorato / cosa resta aperto

Il pezzo più grande e già noto (vedi `CLAUDE.md` → "Parte nota come incompleta"): **`POST
/products/new` è ancora uno stub** (`return res.success({})`). L'intera pipeline di validazione (auth,
upload/validazione immagine, limite 1 immagine, validazione campi) è collegata e funzionante, ma nessun
prodotto viene mai effettivamente creato — e ora che i modelli `Category`/`ProductImage` esistono, andrà
deciso come collegarli alla creazione prodotto (categorie multiple? righe in `product_images` con
`sort_order`?).

Altri comportamenti noti ma **non corretti** (documentati in dettaglio in `backend/docs/API.md` →
"Problemi noti", lasciati così di proposito perché non richiesto o perché la fix corretta non era ovvia):

- **Il cambio password non invalida `current_token`** — un vecchio JWT resta valido dopo il cambio
  password, a differenza del logout. Contraddice il pattern descritto in `CLAUDE.md` stesso.
- `GET /products` risponde **403** anche per errori generici imprevisti (dovrebbe essere 500).
- **Nessuna route protetta per `Customer`**: `controllers/customer/profileCustomerController.js`
  esiste ma è vuoto e non collegato a nessuna route.
- `PATCH /admin/user` richiede sempre sia `name` che `email`, anche se il controller supporterebbe
  l'aggiornamento parziale.
- I file caricati per un prodotto non vengono mai ripuliti (perché `createProduct` non li usa).
- Frontend: ancora solo lo scaffold di Vite, non toccato (fuori scope per istruzioni di progetto).

## Note importanti per le prossime sessioni

- **Scrivi i commit in italiano** e **commenta il codice nuovo in modo verboso e in italiano**
  (regole in `CLAUDE.md`) — non sono le convenzioni di default, sono specifiche di questo progetto.
- Il DB dockerizzato ha **già** tutte le migrazioni e i seed applicati (vedi sopra): non serve
  rieseguirli finché non si aggiungono nuove migrazioni.
- Per eseguire comandi Sequelize CLI contro il DB dockerizzato, vanno lanciati **dentro il container**
  (`docker compose exec backend npx sequelize-cli ...`), perché `config/config.json` punta all'host
  `db`, risolvibile solo nella rete Docker interna — non dalla macchina host.
- La chiave SSH per il push è stata generata su **questa macchina/ambiente**: se l'ambiente di sviluppo
  viene ricreato da zero, il push a `git@github.com` fallirà di nuovo con "Permission denied" finché
  non si ripete la procedura (nuova chiave + aggiunta su github.com/settings/keys).
- Utenti di test disponibili dopo il seed (nel DB di **sviluppo**, `mydatabase`): `master@example.com`
  (superadmin), `mario@example.com` / `luigi@example.com` (admin) — password `password123` per tutti.
- `npm test` ora richiede accesso al servizio `db` di Docker Compose (esegue da solo `pretest`, che crea
  e migra `mydatabase_test`): va lanciato dentro il container backend
  (`docker compose exec backend npm test`), non dalla macchina host se `db` non è risolvibile. Dettagli
  completi in `backend/docs/TESTING.md`.
- Se il demone Docker sembra irraggiungibile (`docker ps` non risponde), probabilmente Docker Desktop si
  è riavviato: va rilanciato lo stack con `docker compose up -d` prima di eseguire qualunque comando
  `docker compose exec`. I test puramente mock (senza DB) possono comunque girare in locale con
  `npx jest <file>` se `backend/node_modules` è popolato sull'host, bypassando `pretest`.
- `JWT_EXPIRES_IN` è ora una variabile d'ambiente reale (non solo un valore hardcoded): se manca,
  `services/tokenService.js` ricade su `1h` di default, ma va tenuta sincronizzata tra `.env`,
  `.env.example` e — se cambia il valore in produzione — comunicata esplicitamente, dato che è una
  policy di sicurezza (durata di validità dei token) e non solo un dettaglio tecnico.