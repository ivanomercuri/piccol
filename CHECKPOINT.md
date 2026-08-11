# CHECKPOINT

Stato del progetto **Piccol** al 2026-08-10, per orientarsi rapidamente in una nuova sessione. Non
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

## Migrazione a TypeScript (in corso, branch `feature/migrazione-typescript`)

Migrazione incrementale JS→TS decisa dall'utente, per layer, senza interrompere lo sviluppo delle
feature esistenti (`allowJs: true` + `checkJs: false` in `tsconfig.json`: JS e TS convivono finché la
migrazione non è completa). Piano completo (inventario file per layer, ordine di conversione, punti
critici già individuati) discusso e confermato con l'utente prima di iniziare — vedi la cronologia di
questa sessione se serve rivederlo per intero.

**Fase 0 (piano) — completata.** Punti critici già individuati per le fasi successive (non ancora
risolti, solo segnalati):
- `models/index.js` carica i modelli con un filtro `file.slice(-3) === '.js'`: quando i modelli
  diventeranno `.ts` questo filtro va rivisto esplicitamente, altrimenti smette di trovarli a runtime.
- I modelli usano il pattern factory `sequelize.define(...)`, non le classi `extends Model`: la scelta
  tra continuare con questo pattern (interfacce scritte a mano) o migrare a classi con
  `InferAttributes`/`InferCreationAttributes` va decisa esplicitamente col developer prima di convertire
  il primo modello (`customer.js`), come richiesto.
- `services/authContract.js`: `assertAuthCompatible` (controllo runtime) andrà valutato per la
  conversione a vincolo di tipo statico, passando dal Data Design & Trade-off Protocol di `AGENTS.md`
  prima di implementare.
- `config/config.json`, `migrations/`, `seeders/` restano `.js`/`.json`, fuori scope (Sequelize CLI li
  esegue con `node` puro, senza transpilazione — niente `.sequelizerc` nel repo che la aggiunga).

**Fase 1 (setup base) — completata, nessun file applicativo ancora convertito.**
- Aggiunte le devDependency: `typescript` (pinnato a **6.0.3**, non l'ultima 7.0.2 — vedi nota sotto),
  `ts-node`, `ts-jest`, `typescript-eslint`, e i pacchetti `@types/*` per le dipendenze che non
  spediscono già i propri tipi (`node`, `express`, `jest`, `supertest`, `cors`, `jsonwebtoken`,
  `multer`). `bcryptjs`, `sequelize`, `mysql2`, `express-validator`, `image-size`, `winston` hanno già i
  propri `.d.ts` inclusi, niente `@types/` per loro.
- `tsconfig.json` nuovo: `strict: true`, `allowJs: true`, `checkJs: false`, `module: "CommonJS"` **senza**
  `moduleResolution` esplicito (impostarlo a `"Node"` genera un errore di deprecazione in TS 6, visibile
  solo se dichiarato esplicitamente — lasciandolo implicito il default equivalente si applica senza
  warning).
- `jest.config.js`: `testMatch` esteso a `*.test.{js,ts}`, aggiunto `transform` per `ts-jest` sui soli
  file `.ts` — i test `.js` esistenti proseguono invariati (verificato: 28 suite / 134 test ancora tutti
  verdi dopo la modifica).
- `eslint.config.js`: aggiunto `typescript-eslint`, **ma non con lo spread diretto** di
  `tseslint.configs.recommended` — quel preset non è vincolato per file di default e finiva per applicare
  regole TS (incluso il divieto di `require()`) a tutti i `.js` esistenti, rompendo il lint su tutto il
  progetto. Corretto con `tseslint.config({ files: ['**/*.ts'], extends: [...] })`, che scopa il preset
  ai soli `.ts`.
- `package.json` → script `dev` aggiornato: `nodemon ... --ext js,ts,json --require
  ts-node/register/transpile-only server.js` (così nodemon guarda anche i futuri `.ts` e il processo può
  eseguirli senza un passaggio di build separato); nuovo script `type-check` (`tsc --noEmit`).
- **Nessun cambiamento a `Dockerfile`**: `npm ci` installa già le devDependency (nessun `--omit=dev`), e
  non c'è ancora una build TS separata da gestire nell'immagine.

**Problema Docker incontrato e risolto in questa fase**: dopo aver ricostruito le immagini `backend`/
`test_backend` con `docker compose build`, il container `backend` già esistente (avviato in una sessione
precedente) continuava a fallire con `Cannot find module 'ts-node/register/transpile-only'` — il volume
anonimo `/app/node_modules` viene **preservato da Docker Compose tra ricreazioni con `docker compose up`**,
quindi il container "vedeva" ancora il `node_modules` di prima della build (senza `ts-node`). Risolto con
`docker compose up -d --force-recreate --renew-anon-volumes backend`. Da ricordare per ogni futura fase
che aggiunge dipendenze: dopo `docker compose build`, il container **long-running** `backend` va
rigenerato con questo flag (i container effimeri creati con `docker compose run --rm ...` non hanno
questo problema, ottengono sempre un volume fresco dall'immagine).

Verificato con: `docker compose run --rm test_backend` (28/28 suite verdi), `docker compose exec backend
npm run type-check` (pulito, nessun file `.ts` ancora da controllare), avvio reale di `npm run dev` nel
container con richiesta HTTP di conferma (`200` su `GET /`).

**Fase 2.1 (`classes/`) — completata.** `classes/InvalidImageTypeError.js` → `.ts`: aggiunta solo
l'annotazione esplicita `field: string;` come class field (richiesta da `strict: true`, altrimenti TS non
saprebbe il tipo di una proprietà assegnata solo nel costruttore), logica invariata. Il file non è ancora
usato da nessuna parte nel codice applicativo (solo testato, vedi `__tests__/InvalidImageTypeError.test.js`
— rimasto `.js`, la conversione dei test è Fase 3): confermato che `require('../classes/InvalidImageTypeError')`
da un test `.js` risolve comunque il nuovo file `.ts` senza modifiche al test, grazie a `ts-jest` +
`moduleFileExtensions` di default di Jest (28/28 suite ancora verdi).

**Fase 2.2 (`config/`) — completata.** `logger.js` e `imageConfig.js` → `.ts`. Qui è emerso un punto
d'interoperabilità CJS/ESM da tenere a mente per **tutti** i file successivi finché convivono `.js` e
`.ts`:
- I file `.js` non ancora convertiti continuano a fare `require('../config/logger')` aspettandosi che il
  valore esportato **sia** il logger stesso, non un modulo con `.default`. Con `module: "CommonJS"`,
  scrivere `export default logger` in TS avrebbe compilato in `exports.default = logger`, rompendo quei
  `require()` in silenzio (avrebbero ricevuto `undefined` chiamando `logger.info(...)`). Soluzione: per un
  modulo che esporta **un singolo valore**, si usa `export = logger;` (sintassi CommonJS-nativa di TS),
  mai `export default`.
- Per un modulo che esporta **più valori con nome** (come `imageConfig.js`, richiesto altrove con
  `const { maxWidth, maxHeight } = require(...)`), gli `export const` standard di TS vanno bene così come
  sono: compilano in proprietà su `exports`, pienamente compatibili con quel destructuring.
- Regola pratica adottata da qui in avanti: `import { x } from 'y'` per gli import (compatibile, compila
  in `require()` sotto al cofano grazie a `esModuleInterop`), ma **mai `export default`** finché esistono
  `require()` da file `.js` non convertiti — `export =` per un valore singolo, `export const`/
  `export function` per più valori con nome.
- Verificato con `docker compose run --rm test_backend` (28/28 verdi) e avvio reale di `npm run dev` nel
  container (`200` su `GET /`, log scritti correttamente da `errorMiddleware`/`responseFormatter` che
  richiedono ancora `logger` con `require()`).

**Fase 2.3 (`models/`) — completata.** Discussa con l'utente la scelta tra due opzioni (pattern factory
attuale + interfacce a mano, vs. classi ES `extends Model` con `InferAttributes`/`InferCreationAttributes`
— pattern ufficiale Sequelize v6), scartando una terza opzione (`sequelize-typescript`, decorator-based,
libreria in più). **Scelta dall'utente: classi + InferAttributes.** Convertiti tutti e 6 i modelli
(`customer.ts`, `user.ts`, `productCategory.ts`, `productImage.ts`, `category.ts`, `product.ts`) più il
loader (`index.ts`). Punti rilevanti:
- **Il loader dinamico (`models/index.js`) filtra i file per estensione letterale `.js`** — esattamente il
  punto critico segnalato in Fase 0, ma è dovuto emergere e essere risolto **subito**, al primo modello
  convertito (`customer.ts`), non a fine fase come pianificato: senza il fix i test fallivano con
  `Cannot read properties of undefined (reading 'destroy')` perché `db.Customer` restava `undefined`.
  Filtro esteso ad accettare anche `.ts` (escludendo `.d.ts`).
- **`Model.init()` in questa versione di Sequelize (6.37.8) richiede una entry per OGNI campo dichiarato
  sulla classe**, inclusi `id`/`createdAt`/`updatedAt`/`deletedAt` — niente leniency implicita per i campi
  "ben noti" come la documentazione ufficiale lascerebbe intendere. Resi espliciti in tutti i modelli
  (stesso comportamento di default di Sequelize, solo scritto invece che implicito).
- **`product.price` (DECIMAL) è tipizzato `string`, non `number`**: Sequelize+mysql2 restituisce i DECIMAL
  come stringa per non perdere precisione, comportamento verificato (non assunto). Nessun codice
  applicativo legge ancora `.price`, quindi zero impatto pratico oggi, ma da ricordare quando
  `productController.js#createProduct` verrà implementato.
- **Le proprietà di associazione caricate via `include`** (`product.images`, `product.categories`,
  `product.creator`) **non sono tipizzate** in questa fase — richiederebbero importare i tipi degli altri
  modelli tra loro, valutato non necessario ora perché nessun consumer è ancora `.ts`. Da rivalutare in
  Fase 2.5 (controller) se un controller convertito ne farà uso.
- **`associate(models)` resta tipizzato `any`** in tutti i modelli (con `eslint-disable-next-line
  @typescript-eslint/no-explicit-any` esplicito) — `models/index.js` non espone ancora un tipo reale per
  il dizionario dei modelli; stessa scelta per `db: Record<string, any>` dentro `index.ts` stesso, per non
  dover enumerare staticamente ogni modello nel loader che esiste apposta per evitarlo.
- Import di Sequelize: `import { Sequelize, Options, DataTypes } from 'sequelize'` (named, non default —
  il pacchetto non ha un default export nei suoi `.d.ts`, anche se a runtime `require('sequelize') ===
  require('sequelize').Sequelize` per un self-reference). `require()` dinamico per-file mantenuto (con
  `eslint-disable-next-line @typescript-eslint/no-require-imports` motivato nel commento) perché l'elenco
  dei modelli da caricare è scoperto a runtime scansionando la cartella — nessun equivalente statico
  possibile senza perdere l'auto-discovery documentata in CLAUDE.md.
- Verificato con `docker compose run --rm test_backend` (28/28 verdi, incluse le associazioni
  `creator`/`images`/`categories` in `product.model.test.js`) e avvio reale di `npm run dev` + richiesta
  HTTP di registrazione end-to-end (`POST /register`, riga poi ripulita dal DB).

**Fase 2.4 (`services/`) — completata.** Ordine: `tokenService.ts` → `authContract.ts` →
`authService.ts` → `registerService.ts` (dipendenze reali, non l'ordine letterale della richiesta
iniziale). Per `authContract.ts`, applicato il Data Design & Trade-off Protocol come richiesto
esplicitamente: presentate le opzioni (a) solo tipi statici vs (b) tipi statici + controllo runtime
mantenuto — **scelta dall'utente: (b)**, loggata in `AGENTS.md` → Design Decisions Log. Punti rilevanti:
- `tokenService.ts`: due cast espliciti e commentati, entrambi motivati da gap **pre-esistenti** resi
  visibili dalla tipizzazione, non introdotti ora — `process.env.JWT_SECRET` è `string | undefined` ma
  `jwt.sign()` non accetta `undefined` (nessuna guardia esisteva né viene aggiunta: se la variabile manca
  a runtime, fallisce esattamente come prima); `expiresIn` richiede il tipo ristretto `StringValue` della
  libreria `ms`, ma il valore arriva da env come `string` generica (la validazione del formato resta
  quella di sempre, fatta da `ms` dentro jsonwebtoken).
- `authContract.ts`: `AuthCompatibleAttributes` (interfaccia, statica) e `REQUIRED_FIELDS` (array,
  runtime) descrivono lo stesso contratto in due punti diversi per scelta esplicita — vanno tenuti a mano
  in sincronia se il contratto cambia (raro, è un contratto fondamentale e stabile).
- `authService.ts`/`registerService.ts`: il vincolo generico (`TAttrs extends AuthCompatibleAttributes`
  sulla FIRMA esterna) protegge davvero i chiamanti a compile-time, ma **all'interno del corpo** Sequelize
  non riesce a risolvere un parametro generico ancora "aperto" per query (`where`) e accessi ai campi
  (limite noto dei tipi TypeScript sugli indexed access non risolti — verificato empiricamente, non
  presunto). Risolto con un cast interno verso il tipo concreto `AuthCompatibleAttributes`, poi un secondo
  cast dell'istanza restituita verso un tipo con proprietà dot-accessibili dirette (`user.password`, non
  `user.getDataValue('password')`) — necessario perché `authService.test.js` mocka `entityModel` con
  oggetti letterali semplici, senza `getDataValue()`: usare quel metodo avrebbe fatto compilare il codice
  ma rotto i mock esistenti a runtime (scoperto rieseguendo la suite, poi corretto). La firma esterna
  resta comunque pienamente tipizzata; solo l'implementazione interna usa cast pragmatici.
- **`id` non fa parte del contratto `AuthCompatibleAttributes`** (non era mai stato verificato nemmeno dal
  vecchio `REQUIRED_FIELDS` runtime): è un'assunzione implicita pre-esistente su cui si basa
  `signToken({ id: user.id, ... })`, mai stata resa esplicita. Segnalata con un commento nel codice invece
  che corretta silenziosamente ampliando il contratto — da valutare se estendere `REQUIRED_FIELDS` in una
  sessione futura, decisione lasciata aperta di proposito.
- Verificato con `docker compose run --rm test_backend` (28/28 verdi) e un round-trip HTTP reale
  registrazione+login attraverso il server in dev (righe poi ripulite dal DB).

**Fase 2.5 (`controllers/`) — completata.** Convertiti tutti e 7 i file: `exampleController.ts` (non
montato su nessuna route, verificato — resta così, solo tipizzato), `listRoutesController.ts` (il grosso
blocco di codice morto dentro un commento JS gigante è stato preservato byte-per-byte, non toccato),
`user/authUserController.ts`, `user/profileUserController.ts`, `customer/authCustomerController.ts`,
`customer/profileCustomerController.ts` (era vuoto, 0 byte, non referenziato — convertito banalmente in
un `.ts` altrettanto vuoto), `product/productController.ts`. Punti rilevanti:
- **Nuovo file `types/express.d.ts`**: estensione ambient di Express, necessaria perché praticamente ogni
  controller usa `res.success(...)`/`res.error(...)` (aggiunti a runtime da
  `middlewares/responseFormatter.js`, non nel tipo `Response` di `@types/express`) e due controller
  leggono `req.user` (valorizzato da `middlewares/authUserMiddleware.js`, non nel tipo `Request`).
  `req.user` è tipizzato con un'interfaccia "duck-typed" minima (solo i campi usati), non l'intera classe
  `User` di `models/user.ts` — stessa scelta già fatta in `services/` per `AuthUserInstance`, per non
  dover riesportare i modelli come tipi (che avrebbe richiesto riaprire la Fase 2.3).
- **`import { User } from '../../models'` non funziona**: `models/index.ts` usa `export = db` (Fase 2.3),
  quindi l'unico import valido è quello di default (`import models from '../../models'; const { User } =
  models;`) — un vero errore di compilazione emerso subito al primo controller convertito, corretto lì e
  applicato allo stesso modo agli altri.
- **`product/productController.ts` — gap pre-esistente segnalato, non corretto**: `getProducts` legge
  `req.user.level`/`req.user.id` **senza** il controllo `if (!req.user) return res.error(401, ...)` che
  invece `profileUserController.js` fa sempre prima di toccare `req.user` — incoerenza già presente nel
  `.js` originale, resa visibile solo ora perché `req.user` è tipizzato opzionale. Risolto con
  un'asserzione non-null (`req.user!`) per preservare il comportamento esatto (nessun controllo aggiunto),
  con un commento che segnala il gap invece di correggerlo silenziosamente.
- Verificato con `docker compose run --rm test_backend` (28/28 verdi) e un round-trip HTTP reale: login
  superadmin → `GET /admin/user` (profilo) → `GET /products`, tutti e tre attraverso il codice appena
  convertito.

**Fase 2.6 (`middlewares/`) — completata.** Tutti i 10 file convertiti, ordine: `responseFormatter.ts` →
`errorMiddleware.ts` → `noPathMiddleware.ts` → `authUserMiddleware.ts` → `skipIfValidationErrorsMiddleware.ts`
→ `uploadMiddleware.ts` → `handleMulterErrorsMiddleware.ts` → `validateProductImageMiddleware.ts` →
`validationHandlerMiddleware.ts` → `checkNumberFilesMiddleware.ts`. Estesa `types/express.d.ts` con
`req.validationErrors` (usato da più file di questa fase) e `res.error`'s `message` allargato a `unknown`
(passa anche array, non solo stringhe — visto in `validationHandlerMiddleware.ts`). Punti rilevanti,
in ordine di importanza:

- **Bug reale e attualmente in produzione, scoperto in questa fase**: `errorMiddleware.js` dichiara solo
  3 parametri (`err, req, res`), non i 4 richiesti da Express (`err, req, res, next`) per essere
  riconosciuto come error-handler — Express lo tratta quindi come middleware normale, mai invocato via
  `next(err)`. **Verificato empiricamente** inviando un body JSON malformato al server reale in dev:
  risponde con la pagina HTML di errore di default di Express (stack trace incluso) invece del
  `res.error(400, 'errore json: ...')` documentato in CLAUDE.md — viola anche il principio "JSON puro"
  di AGENTS.md §6. Come conseguenza, `logger.error(...)` in quel file non scrive mai nei log per errori
  propagati. TypeScript non lo segnala (una funzione a 3 argomenti è strutturalmente compatibile con un
  tipo a 4). **Preservato di proposito** (non corretto), con un commento molto esplicito nel file — è un
  fix a comportamento reale, fuori scope per una sessione di sola tipizzazione.
- **`image-size`: named import vs default import, altra lezione "il mock non è la libreria vera"** (stesso
  tipo di problema di `getDataValue()` in Fase 2.4). Primo tentativo: `import { imageSize } from
  'image-size'` — compila pulito, ma rompe 2 test (`validateProductImageMiddleware.test.js`, che mocka il
  modulo con `jest.mock('image-size', () => jest.fn())`, una funzione nuda senza proprietà `.imageSize`).
  Corretto con `import sizeOf from 'image-size'` (default import): con `esModuleInterop`,
  `__importDefault` gestisce automaticamente sia il pacchetto reale (che ha un vero default export) sia il
  mock (funzione nuda, "srotolata" automaticamente) — è l'equivalente TypeScript esatto del controllo
  manuale `typeof imgSize === 'function' ? imgSize : imgSize.imageSize` che il file .js originale faceva
  a mano. Verificato anche con dati reali (non mock): `productRoutes.test.js` non mocka `image-size` e usa
  un PNG vero attraverso l'intera pipeline di upload — passato.
- **`skipIfValidationErrorsMiddleware.js`**: non risulta montato su nessuna route (come
  `exampleController.js`, Fase 2.5), e la sua logica non fa mai nulla (entrambi i rami chiamano `next()`
  nonostante il nome). Segnalato in un commento, non corretto.
- `validationHandlerMiddleware.ts`: durante la tipizzazione del `reduce` di raggruppamento errori, un
  primo tentativo aveva aggiunto `else if (path)` per soddisfare TypeScript — **individuato e corretto
  prima del commit** perché cambiava comportamento (nel .js originale, un errore senza `path` finiva
  comunque sotto la chiave `"undefined"`, coercizione implicita di JS; il mio `if (path)` lo avrebbe
  invece scartato in silenzio). Risolto con un cast (`path as string`) invece di una guardia, per
  restare fedeli al comportamento originale.
- Verificato con `docker compose run --rm test_backend` (28/28 verdi, incluso il fix di `image-size`) e
  lint pulito (solo il warning pre-esistente su `hardLimitMB` non usato in
  `handleMulterErrorsMiddleware.ts`, invariato dal file .js originale).

**Fase 2.7 (`routes/`, `index.ts`, `server.ts`) — completata, ultima fase di conversione applicativa.**
Convertiti i 5 file di route, `index.ts` e `server.ts`. Due scoperte rilevanti, entrambe con impatto oltre
i soli file di questa fase:

1. **`module.exports = X` "grezzo" (senza usare la parola chiave `export`) non viene riconosciuto da
   TypeScript come export, nemmeno da un altro file `.ts`.** Praticamente tutti i controller/middleware
   con un solo export a funzione, convertiti nelle Fasi 2.5/2.6, usavano questo pattern JS-style — mai
   stato un problema finché venivano `require()`-ati solo da file `.js` ancora non convertiti (`require()`
   grezzo non guarda i tipi). Il problema è emerso al primo file di questa fase (`routes/listRoutes.ts`
   che importa `controllers/listRoutesController.ts`): né l'import con nome né quello di default
   funzionavano, perché TypeScript non trattava affatto quel file come un modulo con export. **Corretto
   retroattivamente in 10 file** (`controllers/listRoutesController.ts` e 9 file in `middlewares/`)
   sostituendo `module.exports = X` con la sintassi TypeScript `export = X` — cambio **puramente
   sintattico, zero impatto a runtime** (verificato: entrambe le forme compilano nello stesso identico
   `module.exports = X` in output), necessario solo perché TypeScript possa riconoscere l'export quando
   un altro file `.ts` prova a importarlo. Da qui in avanti, un modulo con un solo export a funzione/valore
   userà sempre `export = X` (mai `module.exports = X` grezzo).
2. **`nodemon` con un entry-point `.ts` attiva un suo meccanismo automatico di "ts-node detection"** che
   sostituisce silenziosamente l'eseguibile lanciato da `node` al binario CLI di `ts-node` — che ha un suo
   parser di argomenti separato e non riconosce flag nativi di Node come `--inspect`, facendo crashare il
   container (`Error: Unknown or unexpected option: --inspect`) al primo avvio con `server.ts` come entry
   point invece di `server.js`. Risolto forzando esplicitamente `nodemon --exec "node --inspect=... --require
   ts-node/register/transpile-only" server.ts` in `package.json` → script `dev`, che bypassa il rilevamento
   automatico di nodemon. Aggiornato anche il subpath import `#image-config` in `package.json` (puntava
   ancora a `imageConfig.js`, non più esistente dopo la Fase 2.2 — inutilizzato nel codice, corretto per
   coerenza dato che si stava già toccando il file).
- Verificato con `docker compose run --rm test_backend` (28/28 verdi), avvio reale di `npm run dev` con
  `server.ts`, e un round-trip HTTP completo: health-check, login superadmin, profilo, elenco prodotti,
  404 su path inesistente, e riconferma esplicita che il bug di `errorMiddleware.ts` (Fase 2.6) si
  comporta ancora esattamente come prima (JSON malformato → pagina HTML di Express, non la risposta JSON
  documentata).

**Con questa fase si chiude la migrazione di tutto il codice applicativo del backend a TypeScript**
(`classes/`, `config/`, `models/`, `services/`, `controllers/`, `middlewares/`, `routes/`, `index.ts`,
`server.ts`).

## Fase 3 — conversione dei test (in corso)

`jest.config.js` era già pronto dalla Fase 1 (`testMatch` accetta sia `.test.js` sia `.test.ts`,
`ts-jest` configurato): nessun setup aggiuntivo necessario, solo conversione file per file, **senza
toccare la logica dei test**, come richiesto.

**Gruppo modelli (`*.model.test.js` → `.ts`) — completato.** Tutti e 6 convertiti (`customer`, `user`,
`productCategory`, `productImage`, `category`, `product`). Conversione quasi puramente meccanica: tutti
importano `models/index.ts` che espone `db: Record<string, any>` (scelta di Fase 2.3) — significa che
`Customer`, `User`, `Product`, ecc. restano `any` anche in questi test, quindi non c'è quasi nulla da
tipizzare davvero (le variabili `let author/product/category` dichiarate prima di un `beforeAll` hanno
comunque bisogno di un'annotazione esplicita `: any`, altrimenti TypeScript non saprebbe il tipo prima
dell'assegnazione — con `eslint-disable` mirato, dato che `no-explicit-any` è a livello "error" per i
file `.ts`, non "warning" come per `no-unused-vars`). Verificato con `docker compose run --rm
test_backend`: 28/28 suite verdi (il conteggio dei file resta lo stesso, solo l'estensione cambia).

**Gruppo services (`tokenService`, `authContract`, `authService`, `registerService` `.test.js` → `.ts`) —
completato.** Qui, a differenza del gruppo modelli, c'era davvero qualcosa da tipizzare: `authenticate`/
`registerEntity` (Fase 2.4) sono generiche su `ModelStatic<Model<TAttrs, TAttrs>>`, ma questi test passano
oggetti letterali "finti" (`{ name, getAttributes, findOne: jest.fn() }`), non veri modelli Sequelize (che
hanno decine di membri statici in più). Risolto con un cast esplicito e commentato
(`as unknown as FakeModel`, un type alias locale per `ModelStatic<Model<AuthCompatibleAttributes,
AuthCompatibleAttributes>>`) a ogni mock — nessuna logica di test toccata, solo un cast per far convivere
un mock volutamente minimale con una firma ora più precisa. Altri punti minori: `jwt.decode()`/
`jwt.verify()` restituiscono `string | JwtPayload` (rispettivamente anche `null`), serviva un cast a
`JwtPayload` per accedere a `.exp`/`.iat`/`.id`/`.email`, con `!` non-null dove il test assumeva sempre un
valore presente (come nel file .js originale, nessun nuovo controllo aggiunto); in `authContract.test.ts`,
`delete attributes[missingField]` richiede che la proprietà sia opzionale nel tipo — risolto tipizzando
`attributes` come `Partial<Record<keyof AuthCompatibleAttributes, object>>`. Verificato con `docker
compose run --rm test_backend`: 28/28 verdi.

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